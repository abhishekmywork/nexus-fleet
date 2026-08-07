import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GPSDevice } from '../gps-devices/gps-device.entity';

export type EventType =
  | 'IDLE'
  | 'STOPPAGE'
  | 'OVERSPEED'
  | 'GEOFENCE_OUT'
  | 'GEOFENCE_IN'
  | 'TOW_AWAY'
  | 'POWER_CUT'
  | 'LOW_BATTERY'
  | 'HARSH_BRAKING'
  | 'HARSH_ACCELERATION'
  | 'SOS'
  | 'IGNITION_ON'
  | 'IGNITION_OFF'
  | 'DEVICE_OFFLINE';

/** Duration-based events have startedAt + endedAt. Instant events have only startedAt. */
export const DURATION_EVENT_TYPES: EventType[] = [
  'IDLE',
  'STOPPAGE',
  'DEVICE_OFFLINE',
];

/** Geofence events are handled exclusively by checkGeofences(), not the rules loop. */
export const GEOFENCE_EVENT_TYPES: EventType[] = [
  'GEOFENCE_OUT',
  'GEOFENCE_IN',
];

@Entity('events')
@Index(['deviceId', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['tenantId', 'createdAt'])
@Index(['deviceId', 'eventType', 'endedAt'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  deviceId: string;

  @ManyToOne(() => GPSDevice, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'deviceId' })
  device: GPSDevice | null;

  @Column({ type: 'varchar', length: 30 })
  eventType: EventType;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  speed: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;
}
