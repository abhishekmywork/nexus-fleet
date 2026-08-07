import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import type { TwoFactorMethod } from '../users/user.entity';

/**
 * A single-use, expiring OTP code used to complete a 2FA challenge.
 */
@Entity('two_factor_otps')
export class TwoFactorOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.twoFactorOtps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 6 })
  code: string;

  @Column({ type: 'varchar', length: 10 })
  method: TwoFactorMethod;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  consumed: boolean;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
