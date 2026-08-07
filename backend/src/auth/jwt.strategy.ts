import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import type { AppConfig } from '../config/configuration';

interface JwtPayload {
  sub: string;
  email?: string;
}

/**
 * Validates the bearer access token and builds the AuthenticatedUser
 * principal. Roles/permissions are loaded fresh on every request so RBAC
 * changes take effect immediately.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.accessSecret', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();

    const permissions = Array.from(
      new Set(user.roles.flatMap((role) => role.permissions.map((p) => p.key))),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      isSuperUser: user.isSuperUser,
      roles: user.roles.map((role) => role.key),
      permissions,
    };
  }
}
