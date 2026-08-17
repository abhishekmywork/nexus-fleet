/**
 * Canonical permission catalog. New permissions added here (or via the API)
 * can be attached to roles. Keys use the `module:action` convention.
 *
 * `type: "page"`  — controls sidebar visibility (page access)
 * `type: "action"` — controls API operation access (CRUD)
 */
export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  module: string;
  type: 'page' | 'action';
}

export const PERMISSIONS: PermissionDefinition[] = [
  // ─── PAGE PERMISSIONS ────────────────────────────────
  { key: 'page:live_map', name: 'Live Map', description: 'Access the live vehicle tracking map', module: 'pages', type: 'page' },
  { key: 'page:dashboard', name: 'Dashboard', description: 'Access the main dashboard', module: 'pages', type: 'page' },
  { key: 'page:analytics', name: 'Analytics', description: 'Access the analytics dashboard', module: 'pages', type: 'page' },
  { key: 'page:reports', name: 'Reports', description: 'Access the reports section', module: 'pages', type: 'page' },
  { key: 'page:vehicles', name: 'Vehicles', description: 'Access the vehicles management page', module: 'pages', type: 'page' },
  { key: 'page:serving_areas', name: 'Serving Areas', description: 'Access the serving areas page', module: 'pages', type: 'page' },
  { key: 'page:drivers', name: 'Drivers', description: 'Access the drivers management page', module: 'pages', type: 'page' },
  { key: 'page:gps_devices', name: 'GPS Devices', description: 'Access the GPS devices page', module: 'pages', type: 'page' },
  { key: 'page:telemetry', name: 'Telemetry', description: 'Access the telemetry data page', module: 'pages', type: 'page' },
  { key: 'page:events', name: 'Events', description: 'Access the events and alerts page', module: 'pages', type: 'page' },
  { key: 'page:geofences', name: 'Geofences', description: 'Access the geofences management page', module: 'pages', type: 'page' },
  { key: 'page:users', name: 'Users', description: 'Access the users management page', module: 'pages', type: 'page' },
  { key: 'page:products', name: 'Products', description: 'Access the products page', module: 'pages', type: 'page' },
  { key: 'page:roles', name: 'Roles', description: 'Access the roles & permissions page', module: 'pages', type: 'page' },
  { key: 'page:tenants', name: 'Tenants', description: 'Access the tenants management page', module: 'pages', type: 'page' },
  { key: 'page:settings', name: 'Settings', description: 'Access the system settings page', module: 'pages', type: 'page' },
  { key: 'page:activity_logs', name: 'Activity Logs', description: 'Access the activity logs page', module: 'pages', type: 'page' },

  // ─── ACTION PERMISSIONS: users ──────────────────────
  { key: 'users:read', name: 'View users', description: 'List and view users within the tenant', module: 'users', type: 'action' },
  { key: 'users:create', name: 'Create users', description: 'Invite and create users', module: 'users', type: 'action' },
  { key: 'users:update', name: 'Update users', description: 'Edit user profiles, status and roles', module: 'users', type: 'action' },
  { key: 'users:delete', name: 'Delete users', description: 'Remove users from the tenant', module: 'users', type: 'action' },

  // ─── ACTION PERMISSIONS: roles ──────────────────────
  { key: 'roles:read', name: 'View roles', description: 'List roles and their permissions', module: 'roles', type: 'action' },
  { key: 'roles:create', name: 'Create roles', description: 'Create new custom roles', module: 'roles', type: 'action' },
  { key: 'roles:update', name: 'Update roles', description: 'Rename roles and manage their permissions', module: 'roles', type: 'action' },
  { key: 'roles:delete', name: 'Delete roles', description: 'Delete custom roles (system roles are protected)', module: 'roles', type: 'action' },

  // ─── ACTION PERMISSIONS: permissions ────────────────
  { key: 'permissions:read', name: 'View permissions', description: 'List all available permissions', module: 'permissions', type: 'action' },

  // ─── ACTION PERMISSIONS: tenants ────────────────────
  { key: 'tenants:read', name: 'View tenants', description: 'List tenants (super user only)', module: 'tenants', type: 'action' },
  { key: 'tenants:create', name: 'Create tenants', description: 'Provision new tenants (super user only)', module: 'tenants', type: 'action' },
  { key: 'tenants:update', name: 'Update tenants', description: 'Edit tenant details or status (super user only)', module: 'tenants', type: 'action' },
  { key: 'tenants:delete', name: 'Delete tenants', description: 'Delete or suspend tenants (super user only)', module: 'tenants', type: 'action' },

  // ─── ACTION PERMISSIONS: vehicles ───────────────────
  { key: 'vehicles:read', name: 'View vehicles', description: 'List and view vehicles within the tenant', module: 'vehicles', type: 'action' },
  { key: 'vehicles:create', name: 'Create vehicles', description: 'Add new vehicles to the fleet', module: 'vehicles', type: 'action' },
  { key: 'vehicles:update', name: 'Update vehicles', description: 'Edit vehicle details, status and assignments', module: 'vehicles', type: 'action' },
  { key: 'vehicles:delete', name: 'Delete vehicles', description: 'Remove vehicles from the fleet', module: 'vehicles', type: 'action' },

  // ─── ACTION PERMISSIONS: serving_areas ──────────────
  { key: 'serving_areas:read', name: 'View serving areas', description: 'List and view serving areas within the tenant', module: 'serving_areas', type: 'action' },
  { key: 'serving_areas:create', name: 'Create serving areas', description: 'Add new serving areas', module: 'serving_areas', type: 'action' },
  { key: 'serving_areas:update', name: 'Update serving areas', description: 'Edit serving area details', module: 'serving_areas', type: 'action' },
  { key: 'serving_areas:delete', name: 'Delete serving areas', description: 'Remove serving areas', module: 'serving_areas', type: 'action' },

  // ─── ACTION PERMISSIONS: drivers ────────────────────
  { key: 'drivers:read', name: 'View drivers', description: 'List and view drivers within the tenant', module: 'drivers', type: 'action' },
  { key: 'drivers:create', name: 'Create drivers', description: 'Add new drivers', module: 'drivers', type: 'action' },
  { key: 'drivers:update', name: 'Update drivers', description: 'Edit driver details and vehicle assignments', module: 'drivers', type: 'action' },
  { key: 'drivers:delete', name: 'Delete drivers', description: 'Remove drivers', module: 'drivers', type: 'action' },

  // ─── ACTION PERMISSIONS: gps_devices ────────────────
  { key: 'gps_devices:read', name: 'View GPS devices', description: 'List and view GPS devices within the tenant', module: 'gps_devices', type: 'action' },
  { key: 'gps_devices:create', name: 'Create GPS devices', description: 'Register new GPS devices', module: 'gps_devices', type: 'action' },
  { key: 'gps_devices:update', name: 'Update GPS devices', description: 'Edit GPS device details and vehicle assignments', module: 'gps_devices', type: 'action' },
  { key: 'gps_devices:delete', name: 'Delete GPS devices', description: 'Remove GPS devices', module: 'gps_devices', type: 'action' },

  // ─── ACTION PERMISSIONS: audit_logs ─────────────────
  { key: 'audit_logs:read', name: 'View audit logs', description: 'View relationship change history', module: 'audit_logs', type: 'action' },

  // ─── ACTION PERMISSIONS: telemetry ──────────────────
  { key: 'telemetry:read', name: 'View telemetry', description: 'View GPS telemetry and live vehicle tracking data', module: 'telemetry', type: 'action' },

  // ─── ACTION PERMISSIONS: events ─────────────────────
  { key: 'events:read', name: 'View events', description: 'View detected events and alerts', module: 'events', type: 'action' },
  { key: 'events:update', name: 'Manage events', description: 'Acknowledge events and configure event rules', module: 'events', type: 'action' },

  // ─── ACTION PERMISSIONS: geofences ──────────────────
  { key: 'geofences:read', name: 'View geofences', description: 'List and view geofence areas', module: 'geofences', type: 'action' },
  { key: 'geofences:create', name: 'Create geofences', description: 'Create new geofence areas', module: 'geofences', type: 'action' },
  { key: 'geofences:update', name: 'Update geofences', description: 'Edit geofence details and boundaries', module: 'geofences', type: 'action' },
  { key: 'geofences:delete', name: 'Delete geofences', description: 'Remove geofence areas', module: 'geofences', type: 'action' },

  // ─── ACTION PERMISSIONS: notifications ──────────────
  { key: 'notifications:read', name: 'View notification settings', description: 'View email and SMS notification configuration', module: 'notifications', type: 'action' },
  { key: 'notifications:update', name: 'Manage notifications', description: 'Configure email/SMS settings and recipients', module: 'notifications', type: 'action' },

  // ─── ACTION PERMISSIONS: settings ───────────────────
  { key: 'settings:global:read', name: 'View global settings', description: 'View system-wide configuration (super admin only)', module: 'settings', type: 'action' },
  { key: 'settings:global:update', name: 'Update global settings', description: 'Modify system-wide configuration (super admin only)', module: 'settings', type: 'action' },
  { key: 'settings:tenant:read', name: 'View tenant settings', description: 'View tenant-specific fleet configuration', module: 'settings', type: 'action' },
  { key: 'settings:tenant:update', name: 'Update tenant settings', description: 'Modify tenant-specific fleet configuration', module: 'settings', type: 'action' },
];

/**
 * Maps page permissions to the action permissions they require.
 * Used by the role form to auto-enable action permissions when a page is toggled on.
 */
export const PAGE_ACTION_MAP: Record<string, string[]> = {
  'page:live_map':      ['telemetry:read', 'geofences:read'],
  'page:dashboard':     [],
  'page:analytics':     [],
  'page:reports':       ['telemetry:read', 'events:read', 'geofences:read'],
  'page:vehicles':      ['vehicles:read'],
  'page:serving_areas': ['serving_areas:read'],
  'page:drivers':       ['drivers:read'],
  'page:gps_devices':   ['gps_devices:read'],
  'page:telemetry':     ['telemetry:read'],
  'page:events':        ['events:read'],
  'page:geofences':     ['geofences:read'],
  'page:users':         ['users:read'],
  'page:products':      [],
  'page:roles':         ['roles:read', 'permissions:read'],
  'page:tenants':       ['tenants:read'],
  'page:settings':      ['settings:global:read', 'settings:tenant:read'],
  'page:activity_logs': ['audit_logs:read'],
};
