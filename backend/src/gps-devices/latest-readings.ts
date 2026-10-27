import { Repository } from 'typeorm';
import { GPSReading } from './gps-reading.entity';

/**
 * Returns the most recent reading for each of the given devices.
 *
 * Deliberately does **not** use `ROW_NUMBER() OVER (PARTITION BY "deviceId")`:
 * that window function has to materialise every reading ever recorded for the
 * device before the caller discards all but row 1. On production data
 * (~3.4M readings) a single call allocated several GB and OOM-killed the API.
 *
 * The correlated `MAX("timestamp")` subquery only touches the newest row per
 * device and is served by the `("deviceId", "timestamp" DESC)` index.
 */
export async function latestReadingsByDevice(
  readings: Repository<GPSReading>,
  deviceIds: string[],
): Promise<Map<string, Record<string, any>>> {
  const byDevice = new Map<string, Record<string, any>>();
  if (deviceIds.length === 0) return byDevice;

  const rows = await readings
    .createQueryBuilder('r')
    .select('r.*')
    .where('r."deviceId" IN (:...deviceIds)', { deviceIds })
    .andWhere(
      `r."timestamp" = (
        SELECT MAX(r2."timestamp") FROM gps_readings r2
        WHERE r2."deviceId" = r."deviceId"
      )`,
    )
    .getRawMany<Record<string, any>>();

  for (const row of rows) {
    byDevice.set(row.deviceId, row);
  }

  return byDevice;
}
