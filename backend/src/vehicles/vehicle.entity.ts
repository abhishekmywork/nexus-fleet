import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServingArea } from '../serving-areas/serving-area.entity';
import { Driver } from '../drivers/driver.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';

export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  plateNumber: string;

  @Column({ type: 'varchar', length: 80 })
  make: string;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: VehicleStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @ManyToMany(() => ServingArea, (area) => area.vehicles, { eager: true })
  @JoinTable({ name: 'vehicle_serving_areas' })
  servingAreas: ServingArea[];

  @OneToOne(() => Driver, (driver) => driver.vehicle)
  driver: Driver;

  @OneToOne(() => GPSDevice, (device) => device.vehicle)
  gpsDevice: GPSDevice;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
