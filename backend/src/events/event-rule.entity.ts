import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EventType } from './event.entity';

@Entity('event_rules')
export class EventRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  eventType: EventType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  thresholds: Record<string, any> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const DEFAULT_EVENT_RULES: {
  eventType: EventType;
  name: string;
  description: string;
  thresholds: Record<string, any>;
}[] = [
  {
    eventType: 'IDLE',
    name: 'Idle',
    description: 'Vehicle stopped with ignition ON for extended period',
    thresholds: { durationMinutes: 30 },
  },
  {
    eventType: 'STOPPAGE',
    name: 'Stoppage',
    description: 'Vehicle stopped (speed = 0)',
    thresholds: { durationMinutes: 5 },
  },
  {
    eventType: 'OVERSPEED',
    name: 'Overspeed',
    description: 'Vehicle speed exceeds configured threshold',
    thresholds: { maxSpeedKph: 80 },
  },
  {
    eventType: 'GEOFENCE_OUT',
    name: 'Geofence Exit',
    description: 'Vehicle exited a geofence area',
    thresholds: {},
  },
  {
    eventType: 'GEOFENCE_IN',
    name: 'Geofence Entry',
    description: 'Vehicle entered a geofence area',
    thresholds: {},
  },
  {
    eventType: 'TOW_AWAY',
    name: 'Tow Away',
    description: 'Vehicle moving with ignition OFF',
    thresholds: { minSpeedKph: 5 },
  },
  {
    eventType: 'POWER_CUT',
    name: 'Power Cut',
    description: 'Device lost power suddenly',
    thresholds: { gapMinutes: 5 },
  },
  {
    eventType: 'LOW_BATTERY',
    name: 'Low Battery',
    description: 'Device battery below threshold',
    thresholds: { minVoltage: 3.5 },
  },
  {
    eventType: 'HARSH_BRAKING',
    name: 'Harsh Braking',
    description: 'Sudden deceleration detected',
    thresholds: { speedDropKph: 20, windowSeconds: 5 },
  },
  {
    eventType: 'HARSH_ACCELERATION',
    name: 'Harsh Acceleration',
    description: 'Sudden acceleration detected',
    thresholds: { speedIncreaseKph: 20, windowSeconds: 5 },
  },
  {
    eventType: 'SOS',
    name: 'SOS',
    description: 'Emergency button pressed',
    thresholds: {},
  },
  {
    eventType: 'IGNITION_ON',
    name: 'Ignition On',
    description: 'Vehicle ignition turned on',
    thresholds: {},
  },
  {
    eventType: 'IGNITION_OFF',
    name: 'Ignition Off',
    description: 'Vehicle ignition turned off',
    thresholds: {},
  },
  {
    eventType: 'DEVICE_OFFLINE',
    name: 'Device Offline',
    description: 'No telemetry data received for extended period',
    thresholds: { offlineMinutes: 15 },
  },
];
