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

  // ─── EMAIL ──────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  emailEnabled: boolean;

  @Column({ type: 'varchar', length: 255, default: '' })
  smtpHost: string;

  @Column({ type: 'int', default: 587 })
  smtpPort: number;

  @Column({ type: 'boolean', default: false })
  smtpSecure: boolean;

  @Column({ type: 'varchar', length: 255, default: '' })
  smtpUsername: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  smtpPassword: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  fromEmail: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  fromName: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  emailGlobalRecipients: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  emailEventOverrides: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;

  // ─── SMS (SpringEdge) ──────────────────────────────
  @Column({ type: 'boolean', default: false })
  smsEnabled: boolean;

  @Column({ type: 'varchar', length: 500, default: '' })
  smsApiKey: string;

  @Column({ type: 'varchar', length: 11, default: '' })
  smsSenderId: string;

  @Column({ type: 'varchar', length: 20, default: 'transactional' })
  smsType: string;

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
