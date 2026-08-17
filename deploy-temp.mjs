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
  console.log("=== Fix null action values ===");
  await run('docker exec nexus-fleet-postgres-1 psql -U postgres -d nexus_fleet -c "UPDATE audit_logs SET action = \'updated\' WHERE action IS NULL;"');
  console.log("\n=== Widen action column to varchar(30) ===");
  await run('docker exec nexus-fleet-postgres-1 psql -U postgres -d nexus_fleet -c "ALTER TABLE audit_logs ALTER COLUMN action TYPE varchar(30);"');
  console.log("\n=== Widen entityType column to varchar(30) ===");
  await run('docker exec nexus-fleet-postgres-1 psql -U postgres -d nexus_fleet -c "ALTER TABLE audit_logs ALTER COLUMN entityType TYPE varchar(30);"');
  console.log("\n=== Restart backend ===");
  await run("docker restart nexus-fleet-backend-1");
  console.log("\n=== Wait and check ===");
  await new Promise(r => setTimeout(r, 8000));
  await run("docker ps --format \"table {{.Names}}\\t{{.Status}}\"");
  await run("docker logs nexus-fleet-backend-1 --tail 10 2>&1");
  conn.end();
});
conn.on("error", (err) => { console.error(err.message); process.exit(1); });
conn.connect({ host: "147.93.31.140", port: 22, username: "root", password: "MilonSarkar@1984", readyTimeout: 30000 });
