"use client";

import * as React from "react";
import {
  Car,
  Users,
  Radio,
  AlertTriangle,
  MapPin,
  Battery,
  Signal,
  Navigation,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { EVENT_TYPE_LABELS } from "@/components/events/events-table";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { DateRangePicker, type DateRange } from "@/components/date-range-picker";
import type {
  DashboardStats,
  EventTypeStat,
  DashboardEvent,
  VehiclePosition,
  TelemetrySummaryEntry,
} from "@/lib/auth-types";

const EVENT_COLORS: Record<string, string> = {
  SOS: "bg-red-500",
  OVERSPEED: "bg-orange-500",
  TOW_AWAY: "bg-orange-500",
  POWER_CUT: "bg-orange-500",
  HARSH_BRAKING: "bg-orange-500",
  HARSH_ACCELERATION: "bg-orange-500",
  GEOFENCE_OUT: "bg-yellow-500",
  LOW_BATTERY: "bg-yellow-500",
  DEVICE_OFFLINE: "bg-yellow-500",
  GEOFENCE_IN: "bg-green-500",
  IGNITION_ON: "bg-green-500",
  IDLE: "bg-blue-500",
  STOPPAGE: "bg-blue-500",
  IGNITION_OFF: "bg-blue-500",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-600 bg-green-50",
  inactive: "text-gray-600 bg-gray-50",
  maintenance: "text-yellow-600 bg-yellow-50",
};

const EMPTY_STATS: DashboardStats = {
  totalVehicles: 0,
  activeVehicles: 0,
  inactiveVehicles: 0,
  maintenanceVehicles: 0,
  totalDevices: 0,
  totalEvents: 0,
  unacknowledgedEvents: 0,
  eventsToday: 0,
};

function StatCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="size-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EventsByTypeChartSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Events by Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-[130px]" />
            <Skeleton className="h-5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EventsByTypeChart({ data }: { data: EventTypeStat[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Events by Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No events recorded yet.
          </p>
        )}
        {data.slice(0, 10).map((item) => (
          <div key={item.eventType} className="flex items-center gap-3">
            <span className="w-[130px] text-xs text-muted-foreground truncate">
              {EVENT_TYPE_LABELS[item.eventType as keyof typeof EVENT_TYPE_LABELS] ?? item.eventType}
            </span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${EVENT_COLORS[item.eventType] ?? "bg-blue-500"}`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium w-8 text-right">{item.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VehicleStatusChartSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Fleet Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-1">
              <Skeleton className="h-6 w-10 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VehicleStatusChart({ stats }: { stats: DashboardStats }) {
  const total = stats.totalVehicles || 1;
  const segments = [
    { label: "Active", count: stats.activeVehicles, color: "bg-green-500" },
    { label: "Inactive", count: stats.inactiveVehicles, color: "bg-gray-400" },
    { label: "Maintenance", count: stats.maintenanceVehicles, color: "bg-yellow-500" },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Fleet Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-4 rounded-full overflow-hidden">
          {segments.map((s) => (
            <div
              key={s.label}
              className={`${s.color} transition-all`}
              style={{ width: `${(s.count / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {segments.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold">{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentEventsTableSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Events</CardTitle>
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Vehicle</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="size-4 rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentEventsTable({ events }: { events: DashboardEvent[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Events</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="/events">View all</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No events yet. Events appear when telemetry triggers an alert.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {e.vehiclePlate ?? "—"}
                      </div>
                      {e.vehicleMake && (
                        <div className="text-xs text-muted-foreground">
                          {e.vehicleMake} {e.vehicleModel}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-white ${EVENT_COLORS[e.eventType] ?? "bg-blue-500"}`}
                      >
                        {EVENT_TYPE_LABELS[e.eventType as keyof typeof EVENT_TYPE_LABELS] ?? e.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.speed != null ? `${e.speed} km/h` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(e.startedAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {e.acknowledged ? (
                        <CheckCircle2 className="size-4 text-green-600" />
                      ) : (
                        <XCircle className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VehicleMapSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Fleet Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VehicleMap({ positions }: { positions: VehiclePosition[] }) {
  const positioned = positions.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Fleet Map</CardTitle>
      </CardHeader>
      <CardContent>
        {positioned.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No vehicle positions available. Vehicles appear here once they send
            GPS telemetry.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {positioned.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg bg-background border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {v.plateNumber}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_COLORS[v.status] ?? ""}`}
                      >
                        {v.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.latitude?.toFixed(4)}, {v.longitude?.toFixed(4)}
                      {v.speed != null && ` · ${v.speed} km/h`}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {v.ignition === "ON" ? (
                      <span className="text-green-600">IGN ON</span>
                    ) : (
                      <span>IGN OFF</span>
                    )}
                    {v.lastSeen && (
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Clock className="size-3" />
                        {new Date(v.lastSeen).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TelemetryTableSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Telemetry Summary</CardTitle>
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Vehicle</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Ignition</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Odometer</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TelemetryTable({ data }: { data: TelemetrySummaryEntry[] }) {
  if (data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Telemetry Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No telemetry data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Telemetry Summary</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="/telemetry">View all</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Vehicle</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Ignition</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Odometer</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.deviceId}>
                  <TableCell className="font-medium text-sm">
                    {t.vehiclePlate ?? t.imei}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.speed != null ? `${t.speed} km/h` : "—"}
                  </TableCell>
                  <TableCell>
                    {t.ignition === "ON" ? (
                      <span className="text-green-600 text-xs font-medium">ON</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">OFF</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Battery className="size-3.5" />
                      <span className="text-sm">
                        {t.batteryV != null ? `${t.batteryV}V` : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Signal className="size-3.5" />
                      <span className="text-sm">
                        {t.gsmSignal != null ? `${t.gsmSignal}` : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.odometerKm != null ? `${t.odometerKm.toLocaleString()} km` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {t.timestamp
                      ? new Date(t.timestamp).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [eventsByType, setEventsByType] = React.useState<EventTypeStat[]>([]);
  const [recentEvents, setRecentEvents] = React.useState<DashboardEvent[]>([]);
  const [vehiclePositions, setVehiclePositions] = React.useState<VehiclePosition[]>([]);
  const [telemetry, setTelemetry] = React.useState<TelemetrySummaryEntry[]>([]);

  const [statsLoading, setStatsLoading] = React.useState(true);
  const [eventsByTypeLoading, setEventsByTypeLoading] = React.useState(true);
  const [recentEventsLoading, setRecentEventsLoading] = React.useState(true);
  const [vehiclePositionsLoading, setVehiclePositionsLoading] = React.useState(true);
  const [telemetryLoading, setTelemetryLoading] = React.useState(true);

  const [dateRange, setDateRange] = React.useState<DateRange>(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return { from: monday, to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
  });

  const formatDateParam = (d: Date) => d.toISOString();

  React.useEffect(() => {
    const from = formatDateParam(dateRange.from);
    const to = formatDateParam(dateRange.to);

    setStatsLoading(true);
    setEventsByTypeLoading(true);
    setRecentEventsLoading(true);
    setVehiclePositionsLoading(true);
    setTelemetryLoading(true);

    api.dashboard.stats(from, to)
      .then(setStats)
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setStatsLoading(false));

    api.dashboard.eventsByType(from, to)
      .then(setEventsByType)
      .catch(() => toast.error("Failed to load events by type"))
      .finally(() => setEventsByTypeLoading(false));

    api.dashboard.recentEvents(15, from, to)
      .then((data) => setRecentEvents(data as DashboardEvent[]))
      .catch(() => toast.error("Failed to load recent events"))
      .finally(() => setRecentEventsLoading(false));

    api.dashboard.vehiclePositions()
      .then(setVehiclePositions)
      .catch(() => toast.error("Failed to load vehicle positions"))
      .finally(() => setVehiclePositionsLoading(false));

    api.dashboard.telemetrySummary()
      .then(setTelemetry)
      .catch(() => toast.error("Failed to load telemetry"))
      .finally(() => setTelemetryLoading(false));
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={`Welcome back, ${user?.firstName ?? "there"}`}
          description="Fleet overview and real-time monitoring."
        />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Vehicles" value={stats?.totalVehicles ?? 0} icon={Car} color="bg-blue-600" />
            <StatCard label="Active Drivers" value={stats?.totalDevices ?? 0} icon={Radio} color="bg-green-600" />
            <StatCard label="Events in Period" value={stats?.eventsToday ?? 0} icon={AlertTriangle} color="bg-orange-600" />
            <StatCard label="Unacknowledged" value={stats?.unacknowledgedEvents ?? 0} icon={Users} color="bg-red-600" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {statsLoading ? (
            <VehicleStatusChartSkeleton />
          ) : (
            <VehicleStatusChart stats={stats ?? EMPTY_STATS} />
          )}
        </div>
        {eventsByTypeLoading ? (
          <EventsByTypeChartSkeleton />
        ) : (
          <EventsByTypeChart data={eventsByType} />
        )}
      </div>

      {/* Recent Events */}
      {recentEventsLoading ? (
        <RecentEventsTableSkeleton />
      ) : (
        <RecentEventsTable events={recentEvents} />
      )}

      {/* Fleet Map + Telemetry */}
      <div className="grid gap-6 lg:grid-cols-2">
        {vehiclePositionsLoading ? (
          <VehicleMapSkeleton />
        ) : (
          <VehicleMap positions={vehiclePositions} />
        )}
        {telemetryLoading ? (
          <TelemetryTableSkeleton />
        ) : (
          <TelemetryTable data={telemetry.slice(0, 10)} />
        )}
      </div>
    </div>
  );
}
