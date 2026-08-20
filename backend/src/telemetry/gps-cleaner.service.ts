import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GPSReading } from '../gps-devices/gps-reading.entity';

const OSRM_URL = process.env.OSRM_URL || 'http://osrm:5000';
const BATCH_SIZE = 10;
const MAX_SPEED_KMH = 200;
const STATIC_SPEED_THRESHOLD = 2;
const STATIC_DISTANCE_THRESHOLD_M = 10;
const TIME_GAP_MS = 5 * 60 * 1000;
const RDP_EPSILON_M = 10;

interface RawPoint {
  id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: Date;
}

interface CleanedPoint {
  id: string;
  lat: number;
  lon: number;
}

@Injectable()
export class GpsCleanerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GpsCleanerService.name);

  constructor(
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('GPS Cleaner service started — async processing enabled');
  }

  async processUnprocessed(deviceId?: string): Promise<void> {
    try {
      const qb = this.readings
        .createQueryBuilder('r')
        .where('r.processed = :processed', { processed: false });

      if (deviceId) {
        qb.andWhere('r.deviceId = :deviceId', { deviceId });
      }

      const unprocessed = await qb
        .orderBy('r.timestamp', 'ASC')
        .limit(200)
        .getMany();

      if (unprocessed.length === 0) return;

      const byDevice = new Map<string, GPSReading[]>();
      for (const r of unprocessed) {
        const list = byDevice.get(r.deviceId) || [];
        list.push(r);
        byDevice.set(r.deviceId, list);
      }

      for (const [devId, points] of byDevice) {
        await this.processDevicePoints(devId, points);
      }
    } catch (err) {
      this.logger.error('GPS processing failed', err);
    }
  }

  private async processDevicePoints(
    deviceId: string,
    points: GPSReading[],
  ): Promise<void> {
    const raw: RawPoint[] = points.map((p) => ({
      id: p.id,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      speed: p.speed != null ? Number(p.speed) : null,
      timestamp: new Date(p.timestamp),
    }));

    const filtered = this.heuristicFilter(raw);
    const smoothed = this.kalmanSmooth(filtered);
    const snapped = await this.osrmMatch(smoothed);
    const simplified = this.rdpSimplify(snapped, RDP_EPSILON_M);

    const cleanedMap = new Map<string, CleanedPoint>();
    for (const pt of simplified) {
      cleanedMap.set(pt.id, pt);
    }

    for (const pt of points) {
      const cleaned = cleanedMap.get(pt.id);
      if (cleaned) {
        await this.readings.update(pt.id, {
          latitudeCleaned: cleaned.lat,
          longitudeCleaned: cleaned.lon,
          processed: true,
        });
      } else {
        await this.readings.update(pt.id, {
          latitudeCleaned: pt.latitude,
          longitudeCleaned: pt.longitude,
          processed: true,
        });
      }
    }

    this.logger.debug(
      `Processed ${points.length} points for device ${deviceId}: ` +
      `${filtered.length} filtered → ${smoothed.length} smoothed → ` +
      `${snapped.length} snapped → ${simplified.length} simplified`,
    );
  }

  private heuristicFilter(points: RawPoint[]): RawPoint[] {
    if (points.length === 0) return [];

    const result: RawPoint[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();
      if (timeDiff > TIME_GAP_MS) {
        result.push(curr);
        continue;
      }

      if (curr.speed != null && curr.speed > MAX_SPEED_KMH) {
        continue;
      }

      const distM = this.haversineM(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude,
      );

      const isStatic = curr.speed != null && curr.speed < STATIC_SPEED_THRESHOLD;
      const jitter = isStatic && distM < STATIC_DISTANCE_THRESHOLD_M;

      if (jitter) {
        continue;
      }

      if (distM > 0 && timeDiff > 0) {
        const impliedSpeed = (distM / 1000) / (timeDiff / 3600000);
        if (impliedSpeed > MAX_SPEED_KMH) {
          continue;
        }
      }

      result.push(curr);
    }

    return result;
  }

  private kalmanSmooth(points: RawPoint[]): RawPoint[] {
    if (points.length < 3) return points;

    const Q = 0.00001;
    const R_lat = 0.00005;
    const R_lon = 0.00005;

    const result: RawPoint[] = [];
    let latEst = points[0].latitude;
    let lonEst = points[0].longitude;
    let pLat = 1.0;
    let pLon = 1.0;

    result.push({ ...points[0] });

    for (let i = 1; i < points.length; i++) {
      const dt = (points[i].timestamp.getTime() - points[i - 1].timestamp.getTime()) / 1000;
      if (dt <= 0) {
        result.push({ ...points[i] });
        continue;
      }

      const velLat = (points[i].latitude - latEst) * 0.3;
      const velLon = (points[i].longitude - lonEst) * 0.3;

      const predLat = latEst + velLat * Math.min(dt, 10);
      const predLon = lonEst + velLon * Math.min(dt, 10);

      pLat += Q;
      pLon += Q;

      const kLat = pLat / (pLat + R_lat);
      const kLon = pLon / (pLon + R_lon);

      latEst = predLat + kLat * (points[i].latitude - predLat);
      lonEst = predLon + kLon * (points[i].longitude - predLon);

      pLat *= (1 - kLat);
      pLon *= (1 - kLon);

      result.push({
        id: points[i].id,
        latitude: latEst,
        longitude: lonEst,
        speed: points[i].speed,
        timestamp: points[i].timestamp,
      });
    }

    return result;
  }

  private async osrmMatch(points: RawPoint[]): Promise<CleanedPoint[]> {
    if (points.length < 2) {
      return points.map((p) => ({
        id: p.id,
        lat: p.latitude,
        lon: p.longitude,
      }));
    }

    const results: CleanedPoint[] = [];

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      const coords = batch
        .map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`)
        .join(';');

      try {
        const url = `${OSRM_URL}/match/v1/driving/${coords}?overview=full&geometries=geojson&timestamps=${batch.map((p) => Math.floor(p.timestamp.getTime() / 1000)).join(';')}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.matchings?.length > 0) {
          const matching = data.matchings[0];
          const matchCoords: [number, number][] = matching.geometry.coordinates;

          for (let j = 0; j < batch.length; j++) {
            const tracepoint = data.tracepoints?.[j];
            if (tracepoint?.matchings_index != null) {
              const snapIdx = tracepoint.wp_index ?? 0;
              const snapCoord = matchCoords[Math.min(snapIdx, matchCoords.length - 1)];
              results.push({
                id: batch[j].id,
                lat: snapCoord[1],
                lon: snapCoord[0],
              });
            } else {
              results.push({
                id: batch[j].id,
                lat: batch[j].latitude,
                lon: batch[j].longitude,
              });
            }
          }
        } else {
          for (const p of batch) {
            results.push({ id: p.id, lat: p.latitude, lon: p.longitude });
          }
        }
      } catch (err) {
        this.logger.warn(`OSRM match failed for batch, using raw coords: ${err}`);
        for (const p of batch) {
          results.push({ id: p.id, lat: p.latitude, lon: p.longitude });
        }
      }
    }

    return results;
  }

  private rdpSimplify(points: CleanedPoint[], epsilonM: number): CleanedPoint[] {
    if (points.length <= 2) return points;

    const toM = (lat: number, lon: number): [number, number] => [
      lon * 111320 * Math.cos((lat * Math.PI) / 180),
      lat * 110540,
    ];

    const distToSegmentM = (
      px: [number, number],
      a: [number, number],
      b: [number, number],
    ): number => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(px[0] - a[0], px[1] - a[1]);

      let t = ((px[0] - a[0]) * dx + (px[1] - a[1]) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = a[0] + t * dx;
      const projY = a[1] + t * dy;
      return Math.hypot(px[0] - projX, px[1] - projY);
    };

    const rdp = (pts: CleanedPoint[], eps: number): CleanedPoint[] => {
      if (pts.length <= 2) return pts;

      let maxDist = 0;
      let maxIdx = 0;
      const a = toM(pts[0].lat, pts[0].lon);
      const b = toM(pts[pts.length - 1].lat, pts[pts.length - 1].lon);

      for (let i = 1; i < pts.length - 1; i++) {
        const p = toM(pts[i].lat, pts[i].lon);
        const d = distToSegmentM(p, a, b);
        if (d > maxDist) {
          maxDist = d;
          maxIdx = i;
        }
      }

      if (maxDist > eps) {
        const left = rdp(pts.slice(0, maxIdx + 1), eps);
        const right = rdp(pts.slice(maxIdx), eps);
        return [...left.slice(0, -1), ...right];
      }

      return [pts[0], pts[pts.length - 1]];
    };

    return rdp(points, epsilonM);
  }

  private haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
