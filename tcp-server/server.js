require('dotenv').config();

const net = require('net');
const Redis = require('ioredis');

/* ================= CONFIG ================= */

const TCP_PORT = process.env.TCP_PORT || 20000;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;
const STREAM_KEY = 'gps:telemetry:stream';

/* ================= CLIENTS & BUFFERS ================= */

const redisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
};

if (REDIS_PASSWORD) {
    redisOptions.password = REDIS_PASSWORD;
}

const redis = new Redis(redisOptions);
const socketBuffers = new WeakMap();

redis.on('connect', () => console.log('✅ Connected to Redis Streams'));
redis.on('error', err => console.error('❌ Redis Error:', err.message));

/* ============== UTILITIES ================= */

function xorChecksum(str) {
    let chk = 0x00;
    for (let i = 0; i < str.length; i++) {
        chk ^= str.charCodeAt(i);
    }
    return chk === 0xFF ? 0x1B : chk;
}

function parseNMEA(value, hemi) {
    if (!value) return null;
    const degLen = (hemi === 'N' || hemi === 'S') ? 2 : 3;
    const deg = parseInt(value.slice(0, degLen), 10);
    const min = parseFloat(value.slice(degLen));
    let coord = deg + min / 60;
    if (hemi === 'S' || hemi === 'W') coord *= -1;
    return coord;
}

function parseGPRMC(sentence) {
    const f = sentence.replace('$GPRMC,', '').split(',');
    if (f.length < 10) return {};

    return {
        fix_valid: f[1] === 'A',
        latitude: parseNMEA(f[2], f[3]),
        longitude: parseNMEA(f[4], f[5]),
        speed_kph: parseFloat(f[6] || 0) * 1.852,
        course: parseFloat(f[7] || 0),
        date_ddmmyy: f[8],
        time_hhmmss: f[0]
    };
}

function decodeIO(bitmap) {
    if (!bitmap || !bitmap.startsWith('#')) return {};
    const b = bitmap.replace('#', '').split('').map(x => x === '1');

    return {
        ignition: b[0] ? 'ON' : 'OFF',
        main_power: b[7] ? 'ON' : 'OFF',
        immobilizer: b[10] ? 'ARMED' : 'DISARMED',
        sleep: b[11] ? 'NO' : 'YES',
        movement: b[13] ? 'MOVING' : 'STOPPED'
    };
}

/* ============ PACKET DECODER ============== */

function decodeE101Packet(clean) {
    if (!clean.includes('ATL')) {
        return { type: 'UNKNOWN', raw: clean };
    }

    const isLive = clean.includes('\x01');
    const isMemory = clean.includes('\x03');
    const parts = clean.split(',');

    const atlMatch = parts[0].match(/ATL(\d+)/);
    const imei = atlMatch ? atlMatch[1] : parts[0].replace('ATL', '').trim();

    const gprmcIndex = parts.findIndex(p => p.startsWith('$GPRMC'));
    const gprmc = gprmcIndex !== -1
        ? parseGPRMC(parts.slice(gprmcIndex, gprmcIndex + 13).join(','))
        : {};

    const ioBitmap = parts.find(p => p.startsWith('#'));
    const io = decodeIO(ioBitmap);

    const odometer = parseFloat(parts[parts.length - 8]) || 0;
    const temperature = parseFloat(parts[parts.length - 7]) || 0;
    const battery = parseFloat(parts[parts.length - 6]) || 0;
    const gsm = parseInt(parts[parts.length - 5], 10) || 0;

    const mcc = parts[parts.length - 4];
    const mnc = parts[parts.length - 3];
    const lac = parts[parts.length - 2];
    const cellId = parts[parts.length - 1] ? parts[parts.length - 1].replace(/ATL.*/, '') : '';

    return {
        packet_type: isLive ? 'LIVE' : isMemory ? 'MEMORY' : 'UNKNOWN',
        imei,
        ...gprmc,
        ...io,
        odometer_km: odometer,
        temperature_c: temperature,
        battery_v: battery,
        gsm_signal: gsm,
        mcc,
        mnc,
        lac,
        cell_id: cellId,
        raw: clean
    };
}

/* =============== TCP SERVER ================ */

const server = net.createServer(socket => {
    socketBuffers.set(socket, '');

    const clientIp = socket.remoteAddress ? socket.remoteAddress.replace(/^.*:/, '') : 'Unknown';
    console.log(`🔌 [CONNECT] Device connected from IP: ${clientIp}`);

    socket.on('data', chunk => {
        let buffer = socketBuffers.get(socket) + chunk.toString('ascii');

        let packets = buffer.split(/\x1a|\r?\n/);

        socketBuffers.set(socket, packets.pop());

        for (const rawPacket of packets) {
            const clean = rawPacket.replace(/^[\x00-\x1F\x7F]+/, '').trim();
            if (!clean) continue;

            const decoded = decodeE101Packet(clean);

            if (decoded.imei) {
                console.log(`📡 [DATA] IP: ${clientIp} | IMEI: ${decoded.imei} | Type: ${decoded.packet_type}`);
            } else {
                console.log(`⚠️ [UNPARSED PACKET] IP: ${clientIp} | Payload: ${clean}`);
            }

            const chk = xorChecksum(clean);
            socket.write(Buffer.from([chk]));

            if (decoded.imei) {
                const payload = JSON.stringify({
                    source: 'E101',
                    ip: socket.remoteAddress,
                    timestamp: Date.now(),
                    ...decoded
                });

                redis.xadd(STREAM_KEY, '*', 'payload', payload)
                    .then(id => {
                        console.log(`📦 [REDIS PUSH] Key: ${STREAM_KEY} | ID: ${id} | IMEI: ${decoded.imei}`);
                    })
                    .catch(err => {
                        console.error('❌ [REDIS ERROR] Push failed:', err.message);
                    });
            }
        }
    });

    socket.on('close', () => {
        socketBuffers.delete(socket);
        console.log(`❌ [DISCONNECT] Device disconnected from IP: ${clientIp}`);
    });

    socket.on('error', err => {
        console.error(`⚠️ [SOCKET ERROR] IP ${clientIp}:`, err.message);
    });
});

server.listen(TCP_PORT, () => {
    console.log(`🚀 TCP Gateway running on port ${TCP_PORT}`);
});
