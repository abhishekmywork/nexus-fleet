import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notification_settings')
@Index(['tenantId'], { unique: true })
export class NotificationSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  // ─── EMAIL (per-tenant toggles & recipients) ──────────
  @Column({ type: 'boolean', default: false })
  emailEnabled: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  emailGlobalRecipients: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  emailEventOverrides: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;

  // ─── SMS (per-tenant toggles & recipients) ──────────
  @Column({ type: 'boolean', default: false })
  smsEnabled: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  smsGlobalRecipients: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  smsEventOverrides: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
