import { User } from '../../users/user.entity';

/**
 * Serializes a User entity into a safe API shape — strips the password hash
 * and flattens role permissions into a single permission-key list.
 */
export function mapUser(user: User) {
  const permissions = Array.from(
    new Set(user.roles.flatMap((role) => role.permissions.map((p) => p.key))),
  );

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    isSuperUser: user.isSuperUser,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod,
    tenantId: user.tenantId,
    roles: user.roles.map((role) => ({ key: role.key, name: role.name })),
    permissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
