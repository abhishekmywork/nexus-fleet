import { Client } from "ssh2";
const conn = new Client();
const run = (cmd) => new Promise((resolve, reject) => {
  conn.exec(cmd, (err, stream) => {
    if (err) return reject(err);
    let out = "";
    stream.on("data", (d) => { out += d.toString(); process.stdout.write(d.toString()); });
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", (code) => resolve({ code, out }));
  });
});
conn.on("ready", async () => {
  await run("cd /opt/nexus-fleet && git reset --hard origin/main && git pull");
  await run(`cd /opt/nexus-fleet && sed -i 's/"5432:5432"/"15432:5432"/' docker-compose.yml && sed -i 's/"6379:6379"/"16379:6379"/' docker-compose.yml && sed -i 's/"4000:4000"/"14000:4000"/' docker-compose.yml && sed -i 's/"3000:3000"/"13000:3000"/' docker-compose.yml`);
  await run("cd /opt/nexus-fleet && docker compose up -d --build backend frontend 2>&1");
  await run("docker ps --format \"table {{.Names}}\\t{{.Status}}\"");
  await run("docker logs nexus-fleet-backend-1 --tail 10 2>&1");
  conn.end();
});
conn.on("error", (err) => { console.error(err.message); process.exit(1); });
conn.connect({ host: "147.93.31.140", port: 22, username: "root", password: "MilonSarkar@1984", readyTimeout: 30000 });
