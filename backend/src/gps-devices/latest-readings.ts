import { Repository } from 'typeorm';
import { GPSReading } from './gps-reading.entity';

/**
 * Returns the most recent reading for each of the given devices.
 *
 * Two things matter here:
 *
 * 1. No `ROW_NUMBER() OVER (PARTITION BY "deviceId")`. That window function
 *    materialises every reading ever recorded for the device before the caller
 *    discards all but row 1 — on production data (~3.4M readings) a single
 *    call allocated several GB and OOM-killed the API.
 * 2. No correlated `MAX("timestamp")` subquery either. Postgres still scans
 *    every row of the outer relation to evaluate it per row (minutes, not
 *    milliseconds).
 *
 * `DISTINCT ON` with `ORDER BY "deviceId", "timestamp" DESC` is served by the
 * `idx_readings_device_timestamp` index: one backward index scan per device,
 * so the cost is proportional to the number of devices, not to history size.
 */
export async function latestReadingsByDevice(
  readings: Repository<GPSReading>,
  deviceIds: string[],
): Promise<Map<string, Record<string, any>>> {
  const byDevice = new Map<string, Record<string, any>>();
  if (deviceIds.length === 0) return byDevice;

  const placeholders = deviceIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows: Record<string, any>[] = await readings.query(
    `SELECT DISTINCT ON ("deviceId") *
       FROM gps_readings
      WHERE "deviceId" IN (${placeholders})
      ORDER BY "deviceId", "timestamp" DESC`,
    deviceIds,
  );

  for (const row of rows) {
    byDevice.set(row.deviceId, row);
  }

  return byDevice;
}
