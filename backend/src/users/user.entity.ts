import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Role } from '../roles/role.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { TwoFactorOtp } from '../auth/two-factor-otp.entity';

export type TwoFactorMethod = 'email' | 'sms';

/**
 * Application user. Belongs to a tenant, holds roles, and may have 2FA
 * enabled via email or SMS OTP.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 80 })
  firstName: string;

  @Column({ type: 'varchar', length: 80 })
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  /** Bypasses all RBAC checks. Only the seeded bootstrap user has this. */
  @Column({ default: false })
  isSuperUser: boolean;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  twoFactorMethod: TwoFactorMethod | null;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant | null;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable()
  roles: Role[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => TwoFactorOtp, (otp) => otp.user)
  twoFactorOtps: TwoFactorOtp[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
