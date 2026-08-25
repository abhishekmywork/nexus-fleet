const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cd /opt/nexus-fleet && docker compose logs backend --tail=200 2>&1 | grep -i "ERROR\\|recent" | tail -20', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', (d) => { process.stdout.write(d.toString()); });
    stream.stderr.on('data', (d) => { process.stderr.write(d.toString()); });
    stream.on('close', () => { conn.end(); process.exit(0); });
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
  process.exit(1);
}).connect({
  host: '147.93.31.140',
  port: 22,
  username: 'root',
  password: 'MilonSarkar@1984',
  readyTimeout: 10000
});
