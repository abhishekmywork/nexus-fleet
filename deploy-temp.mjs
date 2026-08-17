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
  console.log("=== Backend logs ===");
  await run("docker logs nexus-fleet-backend-1 --tail 50 2>&1");
  conn.end();
});
conn.on("error", (err) => { console.error(err.message); process.exit(1); });
conn.connect({ host: "147.93.31.140", port: 22, username: "root", password: "MilonSarkar@1984", readyTimeout: 30000 });
