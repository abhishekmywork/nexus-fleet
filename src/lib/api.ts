"use client";

import type {
  AuditLog,
  CreateDriverDto,
  CreateGPSDeviceDto,
  CreateRoleDto,
  CreateServingAreaDto,
  CreateUserDto,
  CreateVehicleDto,
  Driver,
  GPSDevice,
  GPSReading,
  LoginResponse,
  LoginResult,
  Permission,
  RegisterResponse,
  Role,
  ServingArea,
  Tenant,
  UpdateDriverDto,
  UpdateGPSDeviceDto,
  UpdateRoleDto,
  UpdateServingAreaDto,
  UpdateUserDto,
  UpdateVehicleDto,
  User,
  Vehicle,
} from "@/lib/auth-types";

export interface ImportValidationResult<T> {
  valid: T[];
  errors: { row: number; message: string }[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const ACCESS_KEY = "nexus_access_token";
const REFRESH_KEY = "nexus_refresh_token";
const USER_KEY = "nexus_user";

export const UNAUTHORIZED_EVENT = "nexus:unauthorized";

/** Extract subdomain from browser hostname for tenant resolution. */
function getSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  if (hostname === "localhost") return null;
  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  return parts[0];
}

/** Storage helpers — guarded so they can run during SSR safely. */

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): User | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setSession(accessToken: string, refreshToken: string, user: User) {
  if (!canUseStorage()) return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function setTokens(accessToken: string, refreshToken: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function broadcastUnauthorized() {
  if (canUseStorage()) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Set to false for public endpoints (login, register, refresh, 2FA). */
  auth?: boolean;
}

/** Centralized fetch: attaches the access token and transparently refreshes on 401. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  // Attach subdomain slug header for tenant resolution
  const tenantSlug = getSubdomainSlug();
  if (tenantSlug) headers["X-Tenant-Slug"] = tenantSlug;

  const send = async (accessToken?: string | null) => {
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      headers: isFormData ? { Authorization: headers.Authorization ?? "" } : headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send(getAccessToken());

  if (response.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(refreshed);
    } else {
      clearSession();
      broadcastUnauthorized();
      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : (data?.message ?? `Request failed (${response.status})`);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Fetch a binary file with auth and trigger a browser download. */
async function downloadFile(path: string, filename: string) {
  const headers: Record<string, string> = {};
  const send = async (accessToken?: string | null) => {
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, { method: "GET", headers });
  };

  let response = await send(getAccessToken());

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(refreshed);
    } else {
      clearSession();
      broadcastUnauthorized();
      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }
  }

  if (!response.ok) {
    throw new ApiError(`Download failed (${response.status})`, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildQuery(path: string, params: Record<string, any>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const query = qs.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/** Typed endpoint bindings used across the admin UI. */
export const api = {
  login: (dto: { email: string; password: string }) =>
    request<LoginResult>("/auth/login", { method: "POST", body: dto, auth: false }),

  register: (dto: { email: string; password: string; firstName: string; lastName: string }) =>
    request<RegisterResponse>("/auth/register", { method: "POST", body: dto, auth: false }),

  verifyTwoFactorLogin: (dto: { twoFactorToken: string; code: string }) =>
    request<LoginResponse>("/auth/2fa/verify-login", {
      method: "POST",
      body: dto,
      auth: false,
    }),

  twoFactorSetup: (method: "email" | "sms") =>
    request<{ method: string; sentTo: string; devCode?: string; expiresInSeconds: number }>(
      "/auth/2fa/setup",
      { method: "POST", body: { method } }
    ),

  twoFactorVerify: (code: string) =>
    request<{ twoFactorEnabled: boolean; twoFactorMethod: string | null }>(
      "/auth/2fa/verify",
      { method: "POST", body: { code } }
    ),

  twoFactorDisable: (code: string) =>
    request<{ twoFactorEnabled: boolean; twoFactorMethod: string | null }>(
      "/auth/2fa/disable",
      { method: "POST", body: { code } }
    ),

  logout: (refreshToken: string) =>
    request<void>("/auth/logout", { method: "POST", body: { refreshToken }, auth: false }),

  me: () => request<User>("/auth/me"),

  updateProfile: (dto: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => request<User>("/auth/me", { method: "PATCH", body: dto }),

  dashboard: {
    stats: () =>
      request<{
        totalVehicles: number;
        activeVehicles: number;
        inactiveVehicles: number;
        maintenanceVehicles: number;
        totalDevices: number;
        totalEvents: number;
        unacknowledgedEvents: number;
        eventsToday: number;
      }>("/dashboard/stats"),
    eventsByType: () =>
      request<Array<{ eventType: string; count: number }>>(
        "/dashboard/events-by-type"
      ),
    recentEvents: (limit = 15) =>
      request<
        Array<{
          id: string;
          eventType: string;
          vehiclePlate: string | null;
          vehicleMake: string | null;
          vehicleModel: string | null;
          latitude: number | null;
          longitude: number | null;
          speed: number | null;
          acknowledged: boolean;
          startedAt: string;
          createdAt: string;
        }>
      >(`/dashboard/recent-events?limit=${limit}`),
    vehiclePositions: () =>
      request<
        Array<{
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
        }>
      >("/dashboard/vehicle-positions"),
    telemetrySummary: () =>
      request<
        Array<{
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
        }>
      >("/dashboard/telemetry-summary"),
  },

  permissions: {
    list: () => request<Permission[]>("/permissions"),
  },

  users: {
    list: () => request<User[]>("/users"),
    create: (dto: CreateUserDto) => request<User>("/users", { method: "POST", body: dto }),
    update: (id: string, dto: UpdateUserDto) =>
      request<User>(`/users/${id}`, { method: "PATCH", body: dto }),
    assignRoles: (id: string, roleKeys: string[]) =>
      request<User>(`/users/${id}/roles`, { method: "PUT", body: { roleKeys } }),
    remove: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  },

  roles: {
    list: () => request<Role[]>("/roles"),
    create: (dto: CreateRoleDto) => request<Role>("/roles", { method: "POST", body: dto }),
    update: (id: string, dto: UpdateRoleDto) =>
      request<Role>(`/roles/${id}`, { method: "PATCH", body: dto }),
    assignPermissions: (id: string, permissionKeys: string[]) =>
      request<Role>(`/roles/${id}/permissions`, {
        method: "PUT",
        body: { permissionKeys },
      }),
    remove: (id: string) => request<void>(`/roles/${id}`, { method: "DELETE" }),
  },

  tenants: {
    list: () => request<Tenant[]>("/tenants"),
    create: (dto: { name: string; slug: string }) =>
      request<Tenant>("/tenants", { method: "POST", body: dto }),
    remove: (id: string) => request<void>(`/tenants/${id}`, { method: "DELETE" }),
    togglePublicLiveMap: (id: string, enabled: boolean) =>
      request<Tenant>(`/tenants/${id}`, { method: "PATCH", body: { publicLiveMap: enabled } }),
  },

  vehicles: {
    list: () => request<Vehicle[]>("/vehicles"),
    get: (id: string) => request<Vehicle>(`/vehicles/${id}`),
    create: (dto: CreateVehicleDto) =>
      request<Vehicle>("/vehicles", { method: "POST", body: dto }),
    update: (id: string, dto: UpdateVehicleDto) =>
      request<Vehicle>(`/vehicles/${id}`, { method: "PATCH", body: dto }),
    remove: (id: string) => request<void>(`/vehicles/${id}`, { method: "DELETE" }),
    assignAreas: (id: string, servingAreaIds: string[]) =>
      request<Vehicle>(`/vehicles/${id}/areas`, {
        method: "PUT",
        body: { servingAreaIds },
      }),
    export: () => downloadFile("/vehicles/export", "vehicles.xlsx"),
    sample: () => downloadFile("/vehicles/sample", "vehicles-sample.xlsx"),
    validateImport: (rows: Record<string, unknown>[]) =>
      request<ImportValidationResult<CreateVehicleDto>>("/vehicles/import", { method: "POST", body: { rows } }),
    confirmImport: (rows: CreateVehicleDto[]) =>
      request<{ imported: number }>("/vehicles/import/confirm", { method: "POST", body: { rows } }),
  },

  servingAreas: {
    list: () => request<ServingArea[]>("/serving-areas"),
    create: (dto: CreateServingAreaDto) =>
      request<ServingArea>("/serving-areas", { method: "POST", body: dto }),
    update: (id: string, dto: UpdateServingAreaDto) =>
      request<ServingArea>(`/serving-areas/${id}`, { method: "PATCH", body: dto }),
    remove: (id: string) => request<void>(`/serving-areas/${id}`, { method: "DELETE" }),
    export: () => downloadFile("/serving-areas/export", "serving-areas.xlsx"),
    sample: () => downloadFile("/serving-areas/sample", "serving-areas-sample.xlsx"),
    validateImport: (rows: Record<string, unknown>[]) =>
      request<ImportValidationResult<CreateServingAreaDto>>("/serving-areas/import", { method: "POST", body: { rows } }),
    confirmImport: (rows: CreateServingAreaDto[]) =>
      request<{ created: number }>("/serving-areas/import/confirm", { method: "POST", body: { rows } }),
  },

  drivers: {
    list: () => request<Driver[]>("/drivers"),
    create: (dto: CreateDriverDto) =>
      request<Driver>("/drivers", { method: "POST", body: dto }),
    update: (id: string, dto: UpdateDriverDto) =>
      request<Driver>(`/drivers/${id}`, { method: "PATCH", body: dto }),
    remove: (id: string) => request<void>(`/drivers/${id}`, { method: "DELETE" }),
    export: () => downloadFile("/drivers/export", "drivers.xlsx"),
    sample: () => downloadFile("/drivers/sample", "drivers-sample.xlsx"),
    validateImport: (rows: Record<string, unknown>[]) =>
      request<ImportValidationResult<CreateDriverDto>>("/drivers/import", { method: "POST", body: { rows } }),
    confirmImport: (rows: CreateDriverDto[]) =>
      request<{ imported: number }>("/drivers/import/confirm", { method: "POST", body: { rows } }),
  },

  gpsDevices: {
    list: () => request<GPSDevice[]>("/gps-devices"),
    create: (dto: CreateGPSDeviceDto) =>
      request<GPSDevice>("/gps-devices", { method: "POST", body: dto }),
    update: (id: string, dto: UpdateGPSDeviceDto) =>
      request<GPSDevice>(`/gps-devices/${id}`, { method: "PATCH", body: dto }),
    remove: (id: string) => request<void>(`/gps-devices/${id}`, { method: "DELETE" }),
    readings: (id: string, limit?: number) =>
      request<GPSReading[]>(`/gps-devices/${id}/readings${limit ? `?limit=${limit}` : ""}`),
    export: () => downloadFile("/gps-devices/export", "gps-devices.xlsx"),
    sample: () => downloadFile("/gps-devices/sample", "gps-devices-sample.xlsx"),
    validateImport: (rows: Record<string, unknown>[]) =>
      request<ImportValidationResult<CreateGPSDeviceDto>>("/gps-devices/import", { method: "POST", body: { rows } }),
    confirmImport: (rows: CreateGPSDeviceDto[]) =>
      request<{ imported: number }>("/gps-devices/import/confirm", { method: "POST", body: { rows } }),
  },

  auditLogs: {
    list: (params?: { entityType?: string; entityId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.entityType) qs.set("entityType", params.entityType);
      if (params?.entityId) qs.set("entityId", params.entityId);
      const query = qs.toString();
      return request<AuditLog[]>(`/audit-logs${query ? `?${query}` : ""}`);
    },
  },

  telemetry: {
    status: () => request<{ connected: boolean }>("/telemetry/status"),
    readings: (params?: {
      page?: number;
      limit?: number;
      imei?: string;
      deviceId?: string;
      from?: string;
      to?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.imei) qs.set("imei", params.imei);
      if (params?.deviceId) qs.set("deviceId", params.deviceId);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      const query = qs.toString();
      return request<{
        data: import("./auth-types").GPSReading[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(`/telemetry/readings${query ? `?${query}` : ""}`);
    },
    latestReadings: () =>
      request<import("./auth-types").GPSReading[]>("/telemetry/readings/latest"),
    trail: (deviceId: string) =>
      request<import("./auth-types").TrailPoint[]>(`/telemetry/trail/${deviceId}`),
  },

  events: {
    list: (params?: {
      page?: number;
      limit?: number;
      deviceId?: string;
      eventType?: string;
      from?: string;
      to?: string;
      acknowledged?: boolean;
    }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.deviceId) qs.set("deviceId", params.deviceId);
      if (params?.eventType) qs.set("eventType", params.eventType);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      if (params?.acknowledged !== undefined)
        qs.set("acknowledged", String(params.acknowledged));
      const query = qs.toString();
      return request<{
        data: import("./auth-types").Event[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(`/events${query ? `?${query}` : ""}`);
    },
    stats: () => request<Record<string, number>>("/events/stats"),
    rules: () => request<import("./auth-types").EventRule[]>("/events/rules"),
    updateRule: (id: string, dto: { enabled?: boolean; thresholds?: Record<string, any> }) =>
      request<import("./auth-types").EventRule>(`/events/rules/${id}`, {
        method: "PATCH",
        body: dto,
      }),
    acknowledge: (id: string) =>
      request<import("./auth-types").Event>(`/events/${id}/acknowledge`, {
        method: "PATCH",
      }),
  },

  geofences: {
    list: () => request<import("./auth-types").Geofence[]>("/geofences"),
    publicByTenant: () =>
      fetch(`${API_BASE.replace(/\/api\/?$/, "")}/api/geofences/public/by-tenant`, {
        headers: getSubdomainSlug() ? { "X-Tenant-Slug": getSubdomainSlug()! } : {},
      }).then((r) => r.json()) as Promise<import("./auth-types").Geofence[]>,
    get: (id: string) => request<import("./auth-types").Geofence>(`/geofences/${id}`),
    create: (dto: {
      name: string;
      type: "circle" | "polygon";
      coordinates: Record<string, any>;
      enabled?: boolean;
    }) =>
      request<import("./auth-types").Geofence>("/geofences", {
        method: "POST",
        body: dto,
      }),
    update: (
      id: string,
      dto: Partial<{
        name: string;
        type: "circle" | "polygon";
        coordinates: Record<string, any>;
        enabled: boolean;
      }>
    ) =>
      request<import("./auth-types").Geofence>(`/geofences/${id}`, {
        method: "PUT",
        body: dto,
      }),
    remove: (id: string) =>
      request<void>(`/geofences/${id}`, { method: "DELETE" }),
    import: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<{
        imported: import("./auth-types").Geofence[];
        skipped: number;
        errors: string[];
      }>("/geofences/import", { method: "POST", body: fd });
    },
  },

  notifications: {
    getSettings: () =>
      request<import("./auth-types").NotificationSettings | null>(
        "/notifications/settings"
      ),
    saveSettings: (dto: Partial<import("./auth-types").NotificationSettings>) =>
      request<import("./auth-types").NotificationSettings>(
        "/notifications/settings",
        { method: "PUT", body: dto }
      ),
    testEmail: (email: string) =>
      request<{ success: boolean }>("/notifications/test/email", {
        method: "POST",
        body: { email },
      }),
    testSms: (phone: string) =>
      request<{ success: boolean }>("/notifications/test/sms", {
        method: "POST",
        body: { phone },
      }),
    getLogs: (page = 1, limit = 20) =>
      request<{
        data: import("./auth-types").NotificationLog[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(`/notifications/logs?page=${page}&limit=${limit}`),
  },

  globalSettings: {
    list: () => request<import("./auth-types").GlobalSetting[]>("/settings/global"),
    get: (key: string) => request<import("./auth-types").GlobalSetting>(`/settings/global/${key}`),
    set: (key: string, value: string, category?: string, description?: string) =>
      request<import("./auth-types").GlobalSetting>(`/settings/global/${key}`, {
        method: "PUT",
        body: { value, category, description },
      }),
    bulkSet: (entries: { key: string; value: string; category?: string; description?: string }[]) =>
      request<import("./auth-types").GlobalSetting[]>("/settings/global", {
        method: "PUT",
        body: { entries },
      }),
  },

  tenantSettings: {
    get: () => request<import("./auth-types").TenantSetting>("/settings/tenant"),
    update: (dto: Partial<import("./auth-types").TenantSetting>) =>
      request<import("./auth-types").TenantSetting>("/settings/tenant", {
        method: "PUT",
        body: dto,
      }),
  },

  liveMap: {
    positions: () => request<import("./auth-types").LivePosition[]>("/live-map/positions"),
    publicPositions: () =>
      fetch(`${API_BASE.replace(/\/api\/?$/, "")}/api/live-map/public/positions`, {
        headers: getSubdomainSlug() ? { "X-Tenant-Slug": getSubdomainSlug()! } : {},
      }).then((r) => r.json()) as Promise<import("./auth-types").LivePosition[]>,
  },

  publicContact: () =>
    fetch(`${API_BASE.replace(/\/api\/?$/, "")}/api/settings/global/public/contact`).then(
      (r) => r.json() as Promise<{ name: string; phone: string; email: string }>
    ),

  reports: {
    vehicleTrips: (params: { from: string; to: string; deviceId?: string }) =>
      request<any[]>(buildQuery("/reports/vehicle-trips", params)),
    dailySummary: (params: { from: string; to: string; deviceId?: string }) =>
      request<any[]>(buildQuery("/reports/daily-summary", params)),
    speedViolations: (params: { from: string; to: string; speedLimit?: number }) =>
      request<any[]>(buildQuery("/reports/speed-violations", params)),
    idleStoppages: (params: { from: string; to: string; minDuration?: number }) =>
      request<any[]>(buildQuery("/reports/idle-stoppages", params)),
    ignition: (params: { from: string; to: string; deviceId?: string }) =>
      request<any[]>(buildQuery("/reports/ignition", params)),
    geofenceEntryExit: (params: { from: string; to: string; geofenceId?: string }) =>
      request<any[]>(buildQuery("/reports/geofence-entry-exit", params)),
    geofenceSummary: (params: { from: string; to: string }) =>
      request<any[]>(buildQuery("/reports/geofence-summary", params)),
    eventLog: (params: { from: string; to: string; eventType?: string; deviceId?: string }) =>
      request<any[]>(buildQuery("/reports/event-log", params)),
    driverActivity: (params: { from: string; to: string; driverId?: string }) =>
      request<any[]>(buildQuery("/reports/driver-activity", params)),
    deviceHealth: (params: { from: string; to: string }) =>
      request<any[]>(buildQuery("/reports/device-health", params)),
  },
};
