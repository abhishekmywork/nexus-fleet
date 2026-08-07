import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedUser } from '../interfaces/auth-user.interface';

/**
 * Global RBAC guard. Requires that the authenticated user holds at least one
 * of the permissions declared via `@Permissions(...)` on the route.
 * Super users bypass the check entirely.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return false;
    if (user.isSuperUser) return true;

    const granted = new Set(user.permissions ?? []);
    const allowed = required.some((permission) => granted.has(permission));
    if (!allowed) {
      throw new ForbiddenException(`Missing permission: ${required.join(' or ')}`);
    }
    return true;
  }
}
