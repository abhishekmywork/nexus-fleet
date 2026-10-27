import { Repository } from 'typeorm';
import { GPSReading } from './gps-reading.entity';

/**
 * Returns the most recent reading for each of the given devices.
 *
 * This must stay cheap: production holds ~3.4M readings, and anything that
 * materialises history per call has already taken the API down twice.
 *
 *  - `ROW_NUMBER() OVER (PARTITION BY "deviceId")` sorts every reading of the
 *    device before the caller keeps row 1 → several GB of heap → OOM.
 *  - `DISTINCT ON ("deviceId") ... ORDER BY ...` is correct but Postgres may
 *    still choose a parallel seq scan + external merge sort (~4.7s).
 *
 * A LATERAL `ORDER BY "timestamp" DESC LIMIT 1` per device is a single
 * backward index dive on `idx_readings_device_timestamp`, so the cost scales
 * with the number of devices, not with history size.
 */
export async function latestReadingsByDevice(
  readings: Repository<GPSReading>,
  deviceIds: string[],
): Promise<Map<string, Record<string, any>>> {
  const byDevice = new Map<string, Record<string, any>>();
  if (deviceIds.length === 0) return byDevice;

  const values = deviceIds.map((_, i) => `($${i + 1}::uuid)`).join(', ');
  const rows: Record<string, any>[] = await readings.query(
    `SELECT r.*
       FROM (VALUES ${values}) AS d(id)
       JOIN LATERAL (
         SELECT *
           FROM gps_readings g
          WHERE g."deviceId" = d.id
          ORDER BY g."timestamp" DESC
          LIMIT 1
       ) r ON TRUE`,
    deviceIds,
  );

  for (const row of rows) {
    byDevice.set(row.deviceId, row);
  }

  return byDevice;
}

/**
 * Ids of the newest reading of every GPS device (one index dive per device).
 * Used where the caller needs full entities/relations rather than raw rows.
 */
export async function latestReadingIdsForAllDevices(
  readings: Repository<GPSReading>,
): Promise<string[]> {
  const rows: { id: string }[] = await readings.query(
    `SELECT r.id
       FROM gps_devices d
       JOIN LATERAL (
         SELECT g.id
           FROM gps_readings g
          WHERE g."deviceId" = d.id
          ORDER BY g."timestamp" DESC
          LIMIT 1
       ) r ON TRUE`,
  );

  return rows.map((row) => row.id);
}
