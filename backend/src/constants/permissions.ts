/**
 * Canonical permission catalog. New permissions added here (or via the API)
 * can be attached to roles. Keys use the `module:action` convention.
 */
export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  module: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  {
    key: 'users:read',
    name: 'View users',
    description: 'List and view users within the tenant',
    module: 'users',
  },
  {
    key: 'users:create',
    name: 'Create users',
    description: 'Invite and create users',
    module: 'users',
  },
  {
    key: 'users:update',
    name: 'Update users',
    description: 'Edit user profiles, status and roles',
    module: 'users',
  },
  {
    key: 'users:delete',
    name: 'Delete users',
    description: 'Remove users from the tenant',
    module: 'users',
  },
  {
    key: 'roles:read',
    name: 'View roles',
    description: 'List roles and their permissions',
    module: 'roles',
  },
  {
    key: 'roles:create',
    name: 'Create roles',
    description: 'Create new custom roles',
    module: 'roles',
  },
  {
    key: 'roles:update',
    name: 'Update roles',
    description: 'Rename roles and manage their permissions',
    module: 'roles',
  },
  {
    key: 'roles:delete',
    name: 'Delete roles',
    description: 'Delete custom roles (system roles are protected)',
    module: 'roles',
  },
  {
    key: 'permissions:read',
    name: 'View permissions',
    description: 'List all available permissions',
    module: 'permissions',
  },
  {
    key: 'tenants:read',
    name: 'View tenants',
    description: 'List tenants (super user only)',
    module: 'tenants',
  },
  {
    key: 'tenants:create',
    name: 'Create tenants',
    description: 'Provision new tenants (super user only)',
    module: 'tenants',
  },
  {
    key: 'tenants:update',
    name: 'Update tenants',
    description: 'Edit tenant details or status (super user only)',
    module: 'tenants',
  },
  {
    key: 'tenants:delete',
    name: 'Delete tenants',
    description: 'Delete or suspend tenants (super user only)',
    module: 'tenants',
  },
  {
    key: 'vehicles:read',
    name: 'View vehicles',
    description: 'List and view vehicles within the tenant',
    module: 'vehicles',
  },
  {
    key: 'vehicles:create',
    name: 'Create vehicles',
    description: 'Add new vehicles to the fleet',
    module: 'vehicles',
  },
  {
    key: 'vehicles:update',
    name: 'Update vehicles',
    description: 'Edit vehicle details, status and assignments',
    module: 'vehicles',
  },
  {
    key: 'vehicles:delete',
    name: 'Delete vehicles',
    description: 'Remove vehicles from the fleet',
    module: 'vehicles',
  },
  {
    key: 'serving_areas:read',
    name: 'View serving areas',
    description: 'List and view serving areas within the tenant',
    module: 'serving_areas',
  },
  {
    key: 'serving_areas:create',
    name: 'Create serving areas',
    description: 'Add new serving areas',
    module: 'serving_areas',
  },
  {
    key: 'serving_areas:update',
    name: 'Update serving areas',
    description: 'Edit serving area details',
    module: 'serving_areas',
  },
  {
    key: 'serving_areas:delete',
    name: 'Delete serving areas',
    description: 'Remove serving areas',
    module: 'serving_areas',
  },
  {
    key: 'drivers:read',
    name: 'View drivers',
    description: 'List and view drivers within the tenant',
    module: 'drivers',
  },
  {
    key: 'drivers:create',
    name: 'Create drivers',
    description: 'Add new drivers',
    module: 'drivers',
  },
  {
    key: 'drivers:update',
    name: 'Update drivers',
    description: 'Edit driver details and vehicle assignments',
    module: 'drivers',
  },
  {
    key: 'drivers:delete',
    name: 'Delete drivers',
    description: 'Remove drivers',
    module: 'drivers',
  },
  {
    key: 'gps_devices:read',
    name: 'View GPS devices',
    description: 'List and view GPS devices within the tenant',
    module: 'gps_devices',
  },
  {
    key: 'gps_devices:create',
    name: 'Create GPS devices',
    description: 'Register new GPS devices',
    module: 'gps_devices',
  },
  {
    key: 'gps_devices:update',
    name: 'Update GPS devices',
    description: 'Edit GPS device details and vehicle assignments',
    module: 'gps_devices',
  },
  {
    key: 'gps_devices:delete',
    name: 'Delete GPS devices',
    description: 'Remove GPS devices',
    module: 'gps_devices',
  },
  {
    key: 'audit_logs:read',
    name: 'View audit logs',
    description: 'View relationship change history',
    module: 'audit_logs',
  },
  {
    key: 'telemetry:read',
    name: 'View telemetry',
    description: 'View GPS telemetry and live vehicle tracking data',
    module: 'telemetry',
  },
  {
    key: 'events:read',
    name: 'View events',
    description: 'View detected events and alerts',
    module: 'events',
  },
  {
    key: 'events:update',
    name: 'Manage events',
    description: 'Acknowledge events and configure event rules',
    module: 'events',
  },
  {
    key: 'geofences:read',
    name: 'View geofences',
    description: 'List and view geofence areas',
    module: 'geofences',
  },
  {
    key: 'geofences:create',
    name: 'Create geofences',
    description: 'Create new geofence areas',
    module: 'geofences',
  },
  {
    key: 'geofences:update',
    name: 'Update geofences',
    description: 'Edit geofence details and boundaries',
    module: 'geofences',
  },
  {
    key: 'geofences:delete',
    name: 'Delete geofences',
    description: 'Remove geofence areas',
    module: 'geofences',
  },
  {
    key: 'notifications:read',
    name: 'View notification settings',
    description: 'View email and SMS notification configuration',
    module: 'notifications',
  },
  {
    key: 'notifications:update',
    name: 'Manage notifications',
    description: 'Configure email/SMS settings and recipients',
    module: 'notifications',
  },
  {
    key: 'settings:global:read',
    name: 'View global settings',
    description: 'View system-wide configuration (super admin only)',
    module: 'settings',
  },
  {
    key: 'settings:global:update',
    name: 'Update global settings',
    description: 'Modify system-wide configuration (super admin only)',
    module: 'settings',
  },
  {
    key: 'settings:tenant:read',
    name: 'View tenant settings',
    description: 'View tenant-specific fleet configuration',
    module: 'settings',
  },
  {
    key: 'settings:tenant:update',
    name: 'Update tenant settings',
    description: 'Modify tenant-specific fleet configuration',
    module: 'settings',
  },
];
