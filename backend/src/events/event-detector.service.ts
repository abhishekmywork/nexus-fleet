import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  Event,
  EventType,
  DURATION_EVENT_TYPES,
  GEOFENCE_EVENT_TYPES,
} from './event.entity';
import { EventRule } from './event-rule.entity';
import { DeviceState, DeviceStateService } from './device-state.service';
import { GeofenceService } from '../geofences/geofence.service';
import { NotificationService } from '../notifications/notification.service';
import { TenantSettingsService } from '../settings/tenant-settings.service';

export interface TelemetryInput {
  deviceId: string;
  imei: string;
  tenantId: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  ignition?: string;
  movement?: string;
  batteryV?: number;
  timestamp?: string;
  raw?: string;
}

@Injectable()
export class EventDetectorService {
  private readonly logger = new Logger(EventDetectorService.name);
  private rulesCache: EventRule[] = [];
  private lastRulesLoad = 0;
  private readonly RULES_CACHE_TTL = 60_000;

  /** Per-device cooldown for instant events: `${deviceId}:${eventType}` → last fire timestamp */
  private readonly instantCooldowns = new Map<string, number>();
  private readonly INSTANT_COOLDOWN_MS = 5 * 60_000; // 5 minutes

  constructor(
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(EventRule)
    private readonly eventRules: Repository<EventRule>,
    private readonly stateService: DeviceStateService,
    private readonly geofenceService: GeofenceService,
    private readonly notificationService: NotificationService,
    private readonly tenantSettingsService: TenantSettingsService,
  ) {}

  private async getRules(): Promise<EventRule[]> {
    const now = Date.now();
    if (this.rulesCache.length === 0 || now - this.lastRulesLoad > this.RULES_CACHE_TTL) {
      this.rulesCache = await this.eventRules.find({ where: { enabled: true } });
      this.lastRulesLoad = now;
    }
    return this.rulesCache;
  }

  async detect(input: TelemetryInput): Promise<void> {
    const rules = await this.getRules();
    if (rules.length === 0) return;

    const state = await this.stateService.getState(input.deviceId);
    const ts = input.timestamp || new Date().toISOString();

    // Check geofence events (handled separately, not via rules loop)
    if (input.latitude != null && input.longitude != null) {
      await this.checkGeofences(input, state, ts);
    }

    for (const rule of rules) {
      // Skip geofence rules — handled exclusively by checkGeofences()
      if (GEOFENCE_EVENT_TYPES.includes(rule.eventType)) continue;
      try {
        await this.evaluateRule(rule, input, state, ts);
      } catch (err) {
        this.logger.error(`Rule ${rule.eventType} failed for device ${input.deviceId}`, err);
      }
    }

    // Update state after all rules evaluated
    await this.stateService.updateFromTelemetry(input.deviceId, input.imei, {
      latitude: input.latitude,
      longitude: input.longitude,
      speed: input.speed,
      ignition: input.ignition,
      movement: input.movement,
      timestamp: ts,
    });
  }

  // ─── GEOFENCE EVENTS ──────────────────────────────────────────────

  private async checkGeofences(
    input: TelemetryInput,
    state: DeviceState | null,
    ts: string,
  ): Promise<void> {
    if (input.latitude == null || input.longitude == null) return;

    const geofences = await this.geofenceService.findEnabledForTenant(input.tenantId);
    const wasInside = state?.inGeofence ?? false;
    const prevGeofenceId = state?.inGeofenceId ?? null;
    const prevGeofenceName = state?.inGeofenceName ?? null;

    const bufferMeters = await this.tenantSettingsService.resolveWithFallback(
      input.tenantId,
      'geofenceBufferMeters',
      'global.geofenceBufferMeters',
      10,
    );

    let isInsideAny = false;
    let closestDistance = Infinity;
    let closestGeofence: { id: string; name: string } | null = null;

    for (const gf of geofences) {
      const distance = this.geofenceService.distanceFromBoundary(
        input.latitude,
        input.longitude,
        gf,
      );
      if (distance < 0) {
        isInsideAny = true;
      }
      if (distance < closestDistance) {
        closestDistance = distance;
        closestGeofence = { id: gf.id, name: gf.name };
      }
    }

    if (wasInside && !isInsideAny && closestDistance > bufferMeters) {
      // Was inside → now outside by more than buffer → GEOFENCE_OUT
      await this.createEvent({
        deviceId: input.deviceId,
        eventType: 'GEOFENCE_OUT',
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed ?? null,
        metadata: {
          ruleName: 'Geofence Exit',
          geofenceId: prevGeofenceId,
          geofenceName: prevGeofenceName ?? 'Unknown',
          bufferMeters,
          distanceFromBoundary: Math.round(closestDistance),
        },
        tenantId: input.tenantId,
        startedAt: new Date(ts),
      });

      if (state) {
        state.inGeofence = false;
        state.inGeofenceId = null;
        state.inGeofenceName = null;
        await this.stateService.setState(input.deviceId, state);
      }
    } else if (!wasInside && isInsideAny) {
      // Was outside → now inside → GEOFENCE_IN
      await this.createEvent({
        deviceId: input.deviceId,
        eventType: 'GEOFENCE_IN',
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed ?? null,
        metadata: {
          ruleName: 'Geofence Entry',
          geofenceId: closestGeofence?.id ?? null,
          geofenceName: closestGeofence?.name ?? 'Unknown',
        },
        tenantId: input.tenantId,
        startedAt: new Date(ts),
      });

      if (state) {
        state.inGeofence = true;
        state.inGeofenceId = closestGeofence?.id ?? null;
        state.inGeofenceName = closestGeofence?.name ?? null;
        await this.stateService.setState(input.deviceId, state);
      }
    } else if (isInsideAny && state) {
      // Still inside — update which geofence we're in
      state.inGeofence = true;
      state.inGeofenceId = closestGeofence?.id ?? null;
      state.inGeofenceName = closestGeofence?.name ?? null;
      await this.stateService.setState(input.deviceId, state);
    }
    // else: was outside, still outside — no state change needed
  }

  // ─── RULE EVALUATION ──────────────────────────────────────────────

  private async evaluateRule(
    rule: EventRule,
    input: TelemetryInput,
    state: DeviceState | null,
    ts: string,
  ): Promise<void> {
    // Start with rule-defined thresholds
    const t: Record<string, any> = { ...(rule.thresholds ?? {}) };

    // Override with tenant-specific settings where applicable
    const tenantId = input.tenantId;
    if (tenantId) {
      const [speedLimit, idleMinutes, stoppageMinutes, offlineMinutes, cooldownMinutes] = await Promise.all([
        this.tenantSettingsService.resolveWithFallback(tenantId, 'defaultSpeedLimit', 'global.defaultSpeedLimit', 120),
        this.tenantSettingsService.resolveWithFallback(tenantId, 'idleThresholdMinutes', 'global.idleThresholdMinutes', 10),
        this.tenantSettingsService.resolveWithFallback(tenantId, 'stoppageThresholdMinutes', 'global.stoppageThresholdMinutes', 5),
        this.tenantSettingsService.resolveWithFallback(tenantId, 'offlineThresholdMinutes', 'global.offlineThresholdMinutes', 30),
        this.tenantSettingsService.resolveWithFallback(tenantId, 'eventCooldownMinutes', 'global.eventCooldownMinutes', 5),
      ]);

      // Apply tenant overrides to thresholds
      if (rule.eventType === 'OVERSPEED' && !t.maxSpeedKph) {
        t.maxSpeedKph = speedLimit;
      }
      if (rule.eventType === 'IDLE' && !t.durationMinutes) {
        t.durationMinutes = idleMinutes;
      }
      if (rule.eventType === 'STOPPAGE' && !t.durationMinutes) {
        t.durationMinutes = stoppageMinutes;
      }
      if (rule.eventType === 'DEVICE_OFFLINE' && !t.offlineMinutes) {
        t.offlineMinutes = offlineMinutes;
      }
    }

    const isDuration = DURATION_EVENT_TYPES.includes(rule.eventType);

    if (isDuration) {
      await this.evaluateDurationRule(rule, input, state, ts, t);
    } else {
      await this.evaluateInstantRule(rule, input, state, ts, t);
    }
  }

  // ─── DURATION EVENTS ───────────────────────────────────────────────

  private async evaluateDurationRule(
    rule: EventRule,
    input: TelemetryInput,
    state: DeviceState | null,
    ts: string,
    t: Record<string, any>,
  ): Promise<void> {
    const conditionMet = this.checkCondition(rule.eventType, input, state, ts, t);
    const openEvent = await this.findOpenEvent(input.deviceId, rule.eventType);

    if (conditionMet && !openEvent) {
      await this.createEvent({
        deviceId: input.deviceId,
        eventType: rule.eventType,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        speed: input.speed ?? null,
        metadata: { ruleName: rule.name },
        tenantId: input.tenantId,
        startedAt: new Date(ts),
      });
    } else if (!conditionMet && openEvent) {
      openEvent.endedAt = new Date(ts);
      await this.events.save(openEvent);
    }
  }

  private checkCondition(
    eventType: EventType,
    input: TelemetryInput,
    state: DeviceState | null,
    ts: string,
    t: Record<string, any>,
  ): boolean {
    switch (eventType) {
      case 'IDLE':
        return this.isIdle(input, state, t);
      case 'STOPPAGE':
        return this.isStoppage(input, state, t);
      case 'DEVICE_OFFLINE':
        return this.isOffline(input, state, t);
      default:
        return false;
    }
  }

  private isIdle(input: TelemetryInput, state: DeviceState | null, t: Record<string, any>): boolean {
    if (input.speed == null || input.speed > 0) return false;
    if (input.ignition !== 'ON') return false;
    const idleStart = state?.idleStartTime;
    if (!idleStart) return false;
    const durationMs = Date.now() - new Date(idleStart).getTime();
    const thresholdMs = (t.durationMinutes ?? 30) * 60_000;
    return durationMs >= thresholdMs;
  }

  private isStoppage(input: TelemetryInput, state: DeviceState | null, t: Record<string, any>): boolean {
    if (input.speed == null || input.speed > 0) return false;
    const stopStart = state?.stopStartTime;
    if (!stopStart) return false;
    const durationMs = Date.now() - new Date(stopStart).getTime();
    const thresholdMs = (t.durationMinutes ?? 5) * 60_000;
    return durationMs >= thresholdMs;
  }

  private isOffline(input: TelemetryInput, state: DeviceState | null, t: Record<string, any>): boolean {
    if (!state?.lastTimestamp) return false;
    const gapMs = Date.now() - new Date(state.lastTimestamp).getTime();
    const thresholdMs = (t.offlineMinutes ?? 15) * 60_000;
    return gapMs >= thresholdMs;
  }

  // ─── INSTANT EVENTS ────────────────────────────────────────────────

  private async evaluateInstantRule(
    rule: EventRule,
    input: TelemetryInput,
    state: DeviceState | null,
    ts: string,
    t: Record<string, any>,
  ): Promise<void> {
    const extra = this.checkInstantCondition(rule.eventType, input, state, ts, t);
    if (!extra) return;

    // Deduplication: skip if same device+type fired within cooldown window
    const cooldownKey = `${input.deviceId}:${rule.eventType}`;
    const lastFired = this.instantCooldowns.get(cooldownKey);
    const now = Date.now();
    if (lastFired && now - lastFired < this.INSTANT_COOLDOWN_MS) return;

    this.instantCooldowns.set(cooldownKey, now);

    // Evict stale cooldown entries periodically (every 1000 entries)
    if (this.instantCooldowns.size > 1000) {
      for (const [key, ts] of this.instantCooldowns) {
        if (now - ts > this.INSTANT_COOLDOWN_MS * 2) {
          this.instantCooldowns.delete(key);
        }
      }
    }

    await this.createEvent({
      deviceId: input.deviceId,
      eventType: rule.eventType,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      speed: input.speed ?? null,
      metadata: { ruleName: rule.name, ...extra },
      tenantId: input.tenantId,
      startedAt: new Date(ts),
    });
  }

  private checkInstantCondition(
    eventType: EventType,
    input: TelemetryInput,
    state: DeviceState | null,
    ts: string,
    t: Record<string, any>,
  ): Record<string, any> | null {
    switch (eventType) {
      case 'OVERSPEED':
        return this.checkOverspeed(input, t);
      case 'TOW_AWAY':
        return this.checkTowAway(input, t);
      case 'POWER_CUT':
        return this.checkPowerCut(input, state, t);
      case 'LOW_BATTERY':
        return this.checkLowBattery(input, t);
      case 'HARSH_BRAKING':
        return this.checkHarshBraking(input, state, t);
      case 'HARSH_ACCELERATION':
        return this.checkHarshAcceleration(input, state, t);
      case 'IGNITION_ON':
        return this.checkIgnitionChange(input, state, 'ON');
      case 'IGNITION_OFF':
        return this.checkIgnitionChange(input, state, 'OFF');
      case 'SOS':
        return this.checkSOS(input);
      default:
        return null;
    }
  }

  private checkOverspeed(input: TelemetryInput, t: Record<string, any>): Record<string, any> | null {
    if (input.speed == null) return null;
    const maxSpeed = t.maxSpeedKph ?? 80;
    if (input.speed <= maxSpeed) return null;
    return { speed: input.speed, maxSpeed };
  }

  private checkTowAway(input: TelemetryInput, t: Record<string, any>): Record<string, any> | null {
    if (input.ignition !== 'OFF') return null;
    if (input.movement !== 'MOVING') return null;
    if (input.speed == null) return null;
    const minSpeed = t.minSpeedKph ?? 5;
    if (input.speed < minSpeed) return null;
    return { speed: input.speed };
  }

  private checkPowerCut(input: TelemetryInput, state: DeviceState | null, t: Record<string, any>): Record<string, any> | null {
    if (!state?.lastTimestamp) return null;
    const gapMs = Date.now() - new Date(state.lastTimestamp).getTime();
    const thresholdMs = (t.gapMinutes ?? 5) * 60_000;
    if (gapMs < thresholdMs) return null;
    return { gapMinutes: Math.floor(gapMs / 60_000) };
  }

  private checkLowBattery(input: TelemetryInput, t: Record<string, any>): Record<string, any> | null {
    if (input.batteryV == null) return null;
    const minVoltage = t.minVoltage ?? 3.5;
    if (input.batteryV >= minVoltage) return null;
    return { voltage: input.batteryV, minVoltage };
  }

  private checkHarshBraking(input: TelemetryInput, state: DeviceState | null, t: Record<string, any>): Record<string, any> | null {
    if (!state?.lastSpeedReadings || state.lastSpeedReadings.length < 2) return null;
    if (input.speed == null) return null;
    const windowSec = t.windowSeconds ?? 5;
    const speedDrop = t.speedDropKph ?? 20;
    const cutoff = Date.now() - windowSec * 1000;
    const recent = state.lastSpeedReadings.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    if (recent.length === 0) return null;
    const maxRecent = Math.max(...recent.map((r) => r.speed));
    const drop = maxRecent - input.speed;
    if (drop < speedDrop) return null;
    return { fromSpeed: maxRecent, toSpeed: input.speed, drop };
  }

  private checkHarshAcceleration(input: TelemetryInput, state: DeviceState | null, t: Record<string, any>): Record<string, any> | null {
    if (!state?.lastSpeedReadings || state.lastSpeedReadings.length < 2) return null;
    if (input.speed == null) return null;
    const windowSec = t.windowSeconds ?? 5;
    const speedIncrease = t.speedIncreaseKph ?? 20;
    const cutoff = Date.now() - windowSec * 1000;
    const recent = state.lastSpeedReadings.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    if (recent.length === 0) return null;
    const minRecent = Math.min(...recent.map((r) => r.speed));
    const increase = input.speed - minRecent;
    if (increase < speedIncrease) return null;
    return { fromSpeed: minRecent, toSpeed: input.speed, increase };
  }

  private checkIgnitionChange(input: TelemetryInput, state: DeviceState | null, target: 'ON' | 'OFF'): Record<string, any> | null {
    if (!state?.lastIgnition) return null;
    if (input.ignition !== target) return null;
    if (state.lastIgnition === target) return null;
    return { previousIgnition: state.lastIgnition, currentIgnition: input.ignition };
  }

  private checkSOS(input: TelemetryInput): Record<string, any> | null {
    if (!input.raw) return null;
    const hasSOS = /SOS|EMERGENCY|panic/i.test(input.raw);
    if (!hasSOS) return null;
    return {};
  }

  // ─── HELPERS ───────────────────────────────────────────────────────

  private async findOpenEvent(deviceId: string, eventType: EventType): Promise<Event | null> {
    return this.events.findOne({
      where: { deviceId, eventType, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
  }

  private async createEvent(data: Partial<Event>): Promise<void> {
    try {
      const event = await this.events.save(this.events.create(data));
      // Fire-and-forget notification dispatch
      this.notificationService.notify(event).catch((err) => {
        this.logger.error(`Notification failed for event ${event.id}`, err);
      });
    } catch (err) {
      this.logger.error('Failed to create event', err);
    }
  }
}
