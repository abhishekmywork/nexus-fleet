import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../interfaces/auth-user.interface';

/**
 * Injects the tenant id that a request is scoped to.
 *
 * Regular users are always scoped to their own tenant (from the JWT).
 * Super users may override it with the `X-Tenant-Id` header to operate
 * inside another tenant's context.
 */
export const CurrentTenantId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser; headers: Record<string, string> }>();

    if (request.user?.isSuperUser) {
      return request.headers['x-tenant-id'] ?? request.user.tenantId ?? null;
    }
    return request.user?.tenantId ?? null;
  },
);
