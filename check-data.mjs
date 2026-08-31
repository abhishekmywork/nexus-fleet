import { Client } from "ssh2";

const conn = new Client();

function runCommand(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (data) => { stdout += data.toString(); });
      stream.stderr.on("data", (data) => { stderr += data.toString(); });
      stream.on("close", () => resolve({ stdout, stderr }));
    });
  });
}

conn.on("ready", async () => {
  console.log("SSH connected.\n");

  const commands = [
    {
      label: "1. Vehicles with GPS devices",
      sql: `docker exec nexus-fleet-postgres-1 psql -U postgres -d nexus_fleet -c "SELECT v.id, v.\\"plateNumber\\", v.\\"tenantId\\", gd.id as device_id, gd.imei FROM vehicles v LEFT JOIN gps_devices gd ON gd.\\"vehicleId\\" = v.id WHERE v.\\"deletedAt\\" IS NULL LIMIT 20;"`
    },
    {
      label: "2. Report query with specific device",
      sql: `docker exec nexus-fleet-postgres-1 psql -U postgres -d nexus_fleet -c "SELECT count(*) as total_readings, count(DISTINCT \\"deviceId\\") as devices FROM gps_readings WHERE \\"deviceId\\" IN (SELECT id FROM gps_devices WHERE \\"tenantId\\" = (SELECT id FROM tenants LIMIT 1));"`
    },
    {
      label: "3. Specific report - device readings",
      sql: `docker exec nexus-fleet-postgres-1 psql -U postgres -d nexus_fleet -c "SELECT gd.id as device_id, gd.imei, v.\\"plateNumber\\", (SELECT count(*) FROM gps_readings gr WHERE gr.\\"deviceId\\" = gd.id) as reading_count FROM gps_devices gd LEFT JOIN vehicles v ON v.id = gd.\\"vehicleId\\" WHERE gd.\\"tenantId\\" = (SELECT id FROM tenants LIMIT 1) LIMIT 10;"`
    }
  ];

  for (const cmd of commands) {
    console.log(`=== ${cmd.label} ===`);
    try {
      const result = await runCommand(conn, cmd.sql);
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error("STDERR:", result.stderr);
    } catch (e) {
      console.error("Error:", e.message);
    }
    console.log("");
  }

  conn.end();
  console.log("Done.");
});

conn.on("error", (err) => {
  console.error("SSH error:", err.message);
});

conn.connect({
  host: "147.93.31.140",
  port: 22,
  username: "root",
  password: "MilonSarkar@1984",
  readyTimeout: 300000,
});
