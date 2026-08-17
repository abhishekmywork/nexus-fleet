import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditEntityType =
  | 'vehicle'
  | 'vehicle_serving_area'
  | 'vehicle_driver'
  | 'vehicle_gps_device'
  | 'tenant'
  | 'user'
  | 'role'
  | 'serving_area'
  | 'geofence'
  | 'event_rule'
  | 'setting';

export type AuditAction =
  | 'assigned'
  | 'unassigned'
  | 'soft_deleted'
  | 'restored'
  | 'permanently_deleted'
  | 'created'
  | 'updated'
  | 'deleted';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 30 })
  entityType: AuditEntityType;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'uuid', nullable: true })
  relatedId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  relatedName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  entityName: string | null;

  @Column({ type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorEmail: string | null;

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;
}
