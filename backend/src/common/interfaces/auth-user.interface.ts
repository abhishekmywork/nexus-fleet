/**
 * The authenticated principal attached to `request.user` by the JWT
 * strategy after a successful authentication + permission load.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string | null;
  isSuperUser: boolean;
  roles: string[];
  /** Flattened permission keys from all of the user's roles. */
  permissions: string[];
}
