export interface RoleSummary {
  key: string;
  name: string;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  module: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSuperUser: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: "totp" | "email" | "sms" | null;
  tenantId: string | null;
  roles: RoleSummary[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  method: string;
  twoFactorToken: string;
  devCode?: string;
  sentTo?: string;
}

export type LoginResult = LoginResponse | TwoFactorChallenge;

export interface RegisterResponse {
  user: User;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId?: string;
  roleKeys?: string[];
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
}

export interface CreateRoleDto {
  key: string;
  name: string;
  description?: string;
  permissionKeys?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
}

export interface ServingArea {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  status: "active" | "inactive" | "maintenance";
  notes: string | null;
  tenantId: string;
  servingAreas: ServingArea[];
  driver: { id: string; firstName: string; lastName: string } | null;
  gpsDevice: { id: string; imei: string; model: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string | null;
  vehicleId: string | null;
  vehicle: { id: string; plateNumber: string; make: string; model: string } | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GPSDevice {
  id: string;
  imei: string;
  model: string;
  serialNumber: string | null;
  simNo: string | null;
  vehicleId: string | null;
  vehicle: { id: string; plateNumber: string; make: string; model: string } | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GPSReading {
  id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
  deviceId: string;
  source: string | null;
  ip: string | null;
  packetType: string | null;
  gpsDate: string | null;
  gpsTime: string | null;
  ignition: string | null;
  mainPower: string | null;
  immobilizer: string | null;
  sleep: string | null;
  movement: string | null;
  odometerKm: number | null;
  temperatureC: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  mcc: string | null;
  mnc: string | null;
  lac: string | null;
  cellId: string | null;
  raw: string | null;
  createdAt: string;
}

export interface CreateVehicleDto {
  plateNumber: string;
  make: string;
  model: string;
  year?: number;
  status?: string;
  notes?: string;
  servingAreaIds?: string[];
}

export interface UpdateVehicleDto {
  plateNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  status?: string;
  notes?: string;
  servingAreaIds?: string[];
}

export interface CreateServingAreaDto {
  name: string;
  description?: string;
}

export interface UpdateServingAreaDto {
  name?: string;
  description?: string;
}

export interface CreateDriverDto {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone?: string;
  vehicleId?: string;
}

export interface UpdateDriverDto {
  firstName?: string;
  lastName?: string;
  licenseNumber?: string;
  phone?: string;
  vehicleId?: string;
}

export interface CreateGPSDeviceDto {
  imei: string;
  model: string;
  serialNumber?: string;
  simNo?: string;
  vehicleId?: string;
}

export interface UpdateGPSDeviceDto {
  imei?: string;
  model?: string;
  serialNumber?: string;
  simNo?: string;
  vehicleId?: string;
}

export interface AuditLog {
  id: string;
  action: "assigned" | "unassigned";
  entityType:
    | "vehicle_serving_area"
    | "vehicle_driver"
    | "vehicle_gps_device";
  entityId: string;
  relatedId: string;
  relatedName: string;
  entityName: string | null;
  actorId: string;
  actorEmail: string | null;
  tenantId: string;
  createdAt: string;
}

export type EventType =
  | "IDLE"
  | "STOPPAGE"
  | "OVERSPEED"
  | "GEOFENCE_OUT"
  | "GEOFENCE_IN"
  | "TOW_AWAY"
  | "POWER_CUT"
  | "LOW_BATTERY"
  | "HARSH_BRAKING"
  | "HARSH_ACCELERATION"
  | "SOS"
  | "IGNITION_ON"
  | "IGNITION_OFF"
  | "DEVICE_OFFLINE";

export interface Event {
  id: string;
  deviceId: string;
  eventType: EventType;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  metadata: Record<string, any> | null;
  acknowledged: boolean;
  startedAt: string;
  endedAt: string | null;
  tenantId: string;
  createdAt: string;
  device?: {
    id: string;
    imei: string;
    vehicle?: {
      id: string;
      plateNumber: string;
      make: string;
      model: string;
    } | null;
  };
}

export interface EventRule {
  id: string;
  eventType: EventType;
  name: string;
  description: string | null;
  enabled: boolean;
  thresholds: Record<string, any> | null;
  updatedAt: string;
}

export type GeofenceType = "circle" | "polygon";

export interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  coordinates: Record<string, any>;
  enabled: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  id: string;
  tenantId: string;
  emailEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  emailGlobalRecipients: string[];
  emailEventOverrides: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;
  smsEnabled: boolean;
  smsApiKey: string;
  smsSenderId: string;
  smsType: string;
  smsGlobalRecipients: string[];
  smsEventOverrides: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  tenantId: string;
  eventType: EventType;
  eventId: string | null;
  channel: "email" | "sms";
  recipients: string[];
  subject: string;
  status: "sent" | "failed" | "skipped";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  inactiveVehicles: number;
  maintenanceVehicles: number;
  totalDevices: number;
  totalEvents: number;
  unacknowledgedEvents: number;
  eventsToday: number;
}

export interface EventTypeStat {
  eventType: string;
  count: number;
}

export interface DashboardEvent {
  id: string;
  eventType: EventType;
  vehiclePlate: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  acknowledged: boolean;
  startedAt: string;
  createdAt: string;
}

export interface VehiclePosition {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  lastSeen: string | null;
}

export interface TelemetrySummaryEntry {
  deviceId: string;
  imei: string;
  vehiclePlate: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  odometerKm: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  temperatureC: number | null;
  timestamp: string;
}

export interface GlobalSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSetting {
  id: string;
  tenantId: string;
  defaultSpeedLimit: number;
  idleThresholdMinutes: number;
  stoppageThresholdMinutes: number;
  offlineThresholdMinutes: number;
  geofenceBufferMeters: number;
  eventCooldownMinutes: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface LivePosition {
  deviceId: string;
  imei: string;
  vehicleId: string | null;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  odometerKm: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  timestamp: string;
}

export interface TrailPoint {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  timestamp: string;
}
