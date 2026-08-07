import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SUPER_USER_KEY } from '../decorators/require-super-user.decorator';
import type { AuthenticatedUser } from '../interfaces/auth-user.interface';

/**
 * Restricts routes marked with `@RequireSuperUser()` to super users only.
 */
@Injectable()
export class SuperUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_USER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    if (!request.user?.isSuperUser) {
      throw new ForbiddenException('This resource is restricted to super users');
    }
    return true;
  }
}
