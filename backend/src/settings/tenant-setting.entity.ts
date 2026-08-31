import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenant_settings')
@Index(['tenantId'], { unique: true })
export class TenantSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ type: 'int', default: 120 })
  defaultSpeedLimit: number;

  @Column({ type: 'int', default: 10 })
  idleThresholdMinutes: number;

  @Column({ type: 'int', default: 5 })
  stoppageThresholdMinutes: number;

  @Column({ type: 'int', default: 30 })
  offlineThresholdMinutes: number;

  @Column({ type: 'int', default: 10 })
  geofenceBufferMeters: number;

  @Column({ type: 'int', default: 5 })
  eventCooldownMinutes: number;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
