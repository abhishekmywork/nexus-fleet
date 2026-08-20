import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GPSDevice } from './gps-device.entity';

@Entity('gps_readings')
export class GPSReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitudeCleaned: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitudeCleaned: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  accuracy: number | null;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  speed: number | null;

  @Column({ type: 'int', nullable: true })
  heading: number | null;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'uuid' })
  deviceId: string;

  @ManyToOne(() => GPSDevice, (device) => device.readings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deviceId' })
  device: GPSDevice;

  @Column({ type: 'varchar', length: 20, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  packetType: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gpsDate: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gpsTime: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ignition: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  mainPower: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  immobilizer: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sleep: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  movement: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  odometerKm: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  temperatureC: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  batteryV: number | null;

  @Column({ type: 'int', nullable: true })
  gsmSignal: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  mcc: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  mnc: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  lac: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cellId: string | null;

  @Column({ type: 'text', nullable: true })
  raw: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
