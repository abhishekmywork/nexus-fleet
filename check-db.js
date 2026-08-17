const { Client } = require('ssh2');
const c = new Client();
const run = (cmd) => new Promise((resolve) => {
  c.exec(cmd, (err, stream) => {
    if (err) return resolve('ERROR: ' + err.message);
    let out = '';
    stream.on('data', d => { out += d; process.stdout.write(d.toString()); });
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => resolve(out));
  });
});
c.on('ready', async () => {
  console.log('=== git pull ===');
  await run('cd /opt/nexus-fleet && git pull origin main 2>&1');
  console.log('\n=== rebuilding backend ===');
  await run('cd /opt/nexus-fleet && docker compose build --no-cache backend 2>&1');
  console.log('\n=== restarting backend ===');
  await run('cd /opt/nexus-fleet && docker compose up -d backend 2>&1');
  console.log('\n=== waiting 15s ===');
  await new Promise(r => setTimeout(r, 15000));
  console.log('\n=== checking routes ===');
  await run('docker logs nexus-fleet-backend-1 2>&1 | grep -i "subscription" | head -20');
  console.log('\n=== last 15 lines ===');
  await run('docker logs nexus-fleet-backend-1 --tail 15 2>&1');
  c.end();
});
c.on('error', (err) => { console.error(err.message); process.exit(1); });
c.connect({ host: '147.93.31.140', username: 'root', password: 'MilonSarkar@1984', readyTimeout: 600000 });
