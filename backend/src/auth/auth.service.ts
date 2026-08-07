import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { Tenant } from '../tenants/tenant.entity';
import { RefreshToken } from './refresh-token.entity';
import { OtpService } from './otp/otp.service';
import { mapUser } from '../common/mappers/user.mapper';
import { parseDurationToMs, sha256 } from '../common/utils/tokens';
import type { AppConfig } from '../config/configuration';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyTwoFactorLoginDto } from './dto/verify-two-factor-login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    const tenant = dto.tenantSlug
      ? await this.tenants.findOne({ where: { slug: dto.tenantSlug } })
      : await this.tenants.findOne({
          where: { slug: this.config.get('seed.defaultTenantSlug', { infer: true }) },
        });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const viewer = await this.getViewerRole();
    const user = this.users.create({
      email,
      phone: dto.phone ?? null,
      passwordHash: await bcrypt.hash(dto.password, 10),
      firstName: dto.firstName,
      lastName: dto.lastName,
      isActive: true,
      isSuperUser: false,
      tenantId: tenant.id,
      roles: viewer ? [viewer] : [],
    });
    const saved = await this.users.save(user);
    return { user: mapUser(saved) };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    // Second step: challenge with an OTP if 2FA is enabled.
    if (user.twoFactorEnabled) {
      const method = user.twoFactorMethod ?? 'email';
      const otp = await this.otpService.generateAndSend(user, method);
      const twoFactorToken = await this.jwt.signAsync(
        { sub: user.id, purpose: '2fa-login' },
        {
          secret: this.config.get('jwt.twoFactorSecret', { infer: true }),
          expiresIn: this.config.get('jwt.twoFactorExpiresIn', { infer: true }),
        },
      );
      return {
        twoFactorRequired: true,
        method,
        sentTo: otp.sentTo,
        devCode: otp.devCode,
        twoFactorToken,
      };
    }

    return this.issueTokens(user);
  }

  async verifyTwoFactorLogin(dto: VerifyTwoFactorLoginDto) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(dto.twoFactorToken, {
        secret: this.config.get('jwt.twoFactorSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired two-factor token');
    }
    if (payload.purpose !== '2fa-login') {
      throw new UnauthorizedException('Invalid two-factor token purpose');
    }

    const user = await this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :id', { id: payload.sub })
      .getOne();
    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('Two-factor authentication is not enabled');
    }

    const ok = await this.otpService.verify(
      user.id,
      user.twoFactorMethod ?? 'email',
      dto.code,
    );
    if (!ok) throw new UnauthorizedException('Invalid or expired code');
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const token = await this.refreshTokens.findOne({
      where: { tokenHash: sha256(dto.refreshToken), revoked: false },
      relations: { user: true },
    });
    if (!token) throw new UnauthorizedException('Invalid refresh token');
    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    const userId = token.user.id;

    // Load the full user with roles and permissions for mapUser
    const user = await this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user || !user.isActive) throw new UnauthorizedException();

    // Rotate: revoke the old token, mint a new pair.
    token.revoked = true;
    await this.refreshTokens.save(token);
    return this.issueTokens(user);
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const token = await this.refreshTokens.findOne({
      where: { tokenHash: sha256(dto.refreshToken), revoked: false },
    });
    if (token) {
      token.revoked = true;
      await this.refreshTokens.save(token);
    }
  }

  async profile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return mapUser(user);
  }

  async updateProfile(
    userId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; currentPassword?: string; newPassword?: string },
  ) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException();

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      const bcrypt = await import('bcryptjs');
      const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!valid) {
        throw new BadRequestException('Current password is incorrect');
      }
      user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    }

    await this.users.save(user);
    return mapUser(user);
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });

    const refreshToken = randomBytes(48).toString('hex');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(
          Date.now() +
            parseDurationToMs(
              this.config.get('jwt.refreshExpiresIn', { infer: true }),
            ),
        ),
      }),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'bearer',
      expiresIn: parseDurationToMs(
        this.config.get('jwt.accessExpiresIn', { infer: true }),
      ),
      user: mapUser(user),
    };
  }

  private async getViewerRole() {
    return this.roles.findOne({ where: { key: 'VIEWER' } });
  }
}
