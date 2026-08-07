import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSReading } from './gps-reading.entity';

@Entity('gps_devices')
export class GPSDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  imei: string;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  serialNumber: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  simNo: string | null;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  @OneToOne(() => Vehicle, (vehicle) => vehicle.gpsDevice, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle | null;

  @OneToMany(() => GPSReading, (reading) => reading.device)
  readings: GPSReading[];

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
