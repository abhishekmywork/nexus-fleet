import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface DeviceState {
  deviceId: string;
  imei: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastSpeed: number | null;
  lastIgnition: string | null;
  lastMovement: string | null;
  lastTimestamp: string | null;
  stopStartTime: string | null;
  idleStartTime: string | null;
  lastSpeedReadings: { speed: number; timestamp: string }[];
  inGeofence: boolean;
  inGeofenceId: string | null;
  inGeofenceName: string | null;
}

const STATE_TTL_SECONDS = 86400; // 24h

@Injectable()
export class DeviceStateService {
  private readonly logger = new Logger(DeviceStateService.name);
  private redis: Redis | null = null;

  private getKey(deviceId: string) {
    return `device:state:${deviceId}`;
  }

  setRedisClient(client: Redis) {
    this.redis = client;
  }

  async getState(deviceId: string): Promise<DeviceState | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.getKey(deviceId));
      if (!raw) return null;
      return JSON.parse(raw) as DeviceState;
    } catch {
      return null;
    }
  }

  async setState(deviceId: string, state: DeviceState): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(
        this.getKey(deviceId),
        STATE_TTL_SECONDS,
        JSON.stringify(state),
      );
    } catch (err) {
      this.logger.error('Failed to set device state in Redis', err);
    }
  }

  async getOrCreateState(
    deviceId: string,
    imei: string,
  ): Promise<DeviceState> {
    const existing = await this.getState(deviceId);
    if (existing) return existing;

    const fresh: DeviceState = {
      deviceId,
      imei,
      lastLatitude: null,
      lastLongitude: null,
      lastSpeed: null,
      lastIgnition: null,
      lastMovement: null,
      lastTimestamp: null,
      stopStartTime: null,
      idleStartTime: null,
      lastSpeedReadings: [],
      inGeofence: false,
      inGeofenceId: null,
      inGeofenceName: null,
    };
    await this.setState(deviceId, fresh);
    return fresh;
  }

  async updateFromTelemetry(
    deviceId: string,
    imei: string,
    data: {
      latitude?: number;
      longitude?: number;
      speed?: number;
      ignition?: string;
      movement?: string;
      timestamp?: string;
    },
  ): Promise<DeviceState> {
    const state = await this.getOrCreateState(deviceId, imei);

    const now = data.timestamp || new Date().toISOString();
    const prevIgnition = state.lastIgnition;
    const prevSpeed = state.lastSpeed;

    // Update position
    if (data.latitude != null) state.lastLatitude = data.latitude;
    if (data.longitude != null) state.lastLongitude = data.longitude;
    if (data.speed != null) state.lastSpeed = data.speed;
    if (data.ignition != null) state.lastIgnition = data.ignition;
    if (data.movement != null) state.lastMovement = data.movement;
    state.lastTimestamp = now;

    // Track speed history for harsh braking/acceleration (keep last 10 readings)
    if (data.speed != null) {
      state.lastSpeedReadings.push({ speed: data.speed, timestamp: now });
      if (state.lastSpeedReadings.length > 10) {
        state.lastSpeedReadings = state.lastSpeedReadings.slice(-10);
      }
    }

    // Track stop/idle start times
    const speed = data.speed ?? state.lastSpeed ?? 0;
    if (speed === 0) {
      if (!state.stopStartTime) state.stopStartTime = now;
      if (prevIgnition === 'ON' && !state.idleStartTime) {
        state.idleStartTime = now;
      }
    } else {
      state.stopStartTime = null;
      state.idleStartTime = null;
    }

    await this.setState(deviceId, state);
    return state;
  }
}
