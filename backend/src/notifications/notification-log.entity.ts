import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventType } from '../events/event.entity';

@Entity('notification_logs')
@Index(['tenantId', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ type: 'varchar', length: 30 })
  eventType: EventType;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({ type: 'varchar', length: 10 })
  channel: 'email' | 'sms';

  @Column({ type: 'jsonb', default: () => "'[]'" })
  recipients: string[];

  @Column({ type: 'varchar', length: 500, default: '' })
  subject: string;

  @Column({ type: 'varchar', length: 10, default: 'sent' })
  status: 'sent' | 'failed' | 'skipped';

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
