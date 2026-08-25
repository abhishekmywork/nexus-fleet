"use client";

import { useState, useEffect, useCallback } from "react";
import { DateRangePicker, type DateRange } from "@/components/date-range-picker";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const CHART_COLORS = {
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#a855f7",
  gray: "#9ca3af",
};

const CHART_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-36" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-1" style={{ gridTemplateColumns: "48px repeat(24, 1fr)" }}>
        {Array.from({ length: 7 }).map((_, row) => (
          Array.from({ length: 25 }).map((_, col) => (
            <Skeleton key={`${row}-${col}`} className="aspect-square rounded-sm" />
          ))
        ))}
      </div>
    </div>
  );
}

function SpeedSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StoppageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function GeofenceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-16 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function DriverSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function OverviewSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <OverviewSkeleton />;
  if (!data) return null;

  const cards = [
    { title: "Total Vehicles", value: data.totalVehicles ?? 0, suffix: "", desc: "Registered in fleet" },
    { title: "Active Vehicles", value: data.activeVehicles ?? 0, suffix: "", desc: "Sending telemetry" },
    { title: "Maintenance", value: data.maintenanceVehicles ?? 0, suffix: "", desc: "Under maintenance" },
    { title: "Fleet Utilization", value: data.fleetUtilization ?? 0, suffix: "%", desc: "Active / total" },
    { title: "Total Distance", value: data.totalDistanceKm ?? 0, suffix: " km", desc: "Distance covered" },
    { title: "Avg Speed", value: data.avgSpeed ?? 0, suffix: " km/h", desc: "Fleet average" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeof c.value === "number" ? c.value.toLocaleString() : c.value}{c.suffix}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HeatmapSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <HeatmapSkeleton />;
  if (!data || !Array.isArray(data)) return <div className="text-sm text-muted-foreground">No heatmap data available.</div>;

  const maxCount = Math.max(...data.map((d: any) => d.count), 1);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const grid: Record<string, number> = {};
  data.forEach((d: any) => { grid[`${d.dayOfWeek}-${d.hour}`] = d.count; });

  function cellColor(count: number) {
    const ratio = count / maxCount;
    if (ratio === 0) return "bg-gray-100 dark:bg-gray-800";
    if (ratio < 0.2) return "bg-blue-200 dark:bg-blue-900";
    if (ratio < 0.4) return "bg-blue-300 dark:bg-blue-800";
    if (ratio < 0.6) return "bg-blue-400 dark:bg-blue-700";
    if (ratio < 0.8) return "bg-blue-500 dark:bg-blue-600";
    return "bg-blue-600 dark:bg-blue-500";
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Event Frequency Heatmap</div>
      <div className="overflow-x-auto">
        <div className="grid gap-1 min-w-[600px]" style={{ gridTemplateColumns: "48px repeat(24, 1fr)" }}>
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-[10px] text-muted-foreground text-center">{h}</div>
          ))}
          {dayLabels.map((day, di) => (
            <>
              <div key={`label-${di}`} className="text-xs text-muted-foreground flex items-center">{day}</div>
              {Array.from({ length: 24 }).map((_, h) => {
                const count = grid[`${di}-${h}`] ?? 0;
                return (
                  <div
                    key={`${di}-${h}`}
                    className={`aspect-square rounded-sm ${cellColor(count)} transition-colors`}
                    title={`${day} ${h}:00 — ${count} events`}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpeedSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <SpeedSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Speed Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.distribution ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Speed Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Vehicle</th>
                    <th className="pb-2 font-medium">Speed</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topViolations ?? []).slice(0, 10).map((v: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{v.vehiclePlate}</td>
                      <td className="py-2 font-medium text-red-600">{v.speed} km/h</td>
                      <td className="py-2 text-muted-foreground">{new Date(v.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Speed by Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(data.avgSpeedByVehicle ?? []).slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="plateNumber" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="avgSpeed" fill={CHART_COLORS.emerald} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StoppageSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <StoppageSkeleton />;
  if (!data) return null;

  const donutData = [
    { name: "Idle", value: data.totalIdleMinutes ?? 0, color: CHART_COLORS.amber },
    { name: "Driving", value: data.totalDrivingMinutes ?? 0, color: CHART_COLORS.emerald },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Idle vs Driving Time</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={(props) => `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Longest Stoppages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Vehicle</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Start</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topStoppages ?? []).slice(0, 10).map((s: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{s.vehiclePlate}</td>
                      <td className="py-2 font-medium">{s.durationMinutes} min</td>
                      <td className="py-2 text-muted-foreground">{new Date(s.startTime).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Idle Time by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.idleByHour ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="totalMinutes" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function GeofenceSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <GeofenceSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data.zoneStats ?? []).map((z: any) => (
          <Card key={z.geofenceId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{z.geofenceName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-lg font-bold text-emerald-600">{z.entryCount}</div>
                  <div className="text-muted-foreground">Entries</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">{z.exitCount}</div>
                  <div className="text-muted-foreground">Exits</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{z.avgDwellMinutes}</div>
                  <div className="text-muted-foreground">Avg Dwell (min)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Geofence Violations by Vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.violationsByVehicle ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="vehiclePlate" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="exitCount" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function DriverSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <DriverSkeleton />;
  if (!data || !Array.isArray(data)) return null;

  const barData = data.map((d: any) => ({
    name: `${d.firstName} ${d.lastName}`,
    score: d.score,
    fill: d.score >= 80 ? CHART_COLORS.emerald : d.score >= 50 ? CHART_COLORS.amber : CHART_COLORS.red,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Driver Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {barData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Driver Detail Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Driver</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Overspeed</th>
                  <th className="pb-2 font-medium">Harsh Brake</th>
                  <th className="pb-2 font-medium">Harsh Accel</th>
                  <th className="pb-2 font-medium">SOS</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d: any) => (
                  <tr key={d.driverId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{d.firstName} {d.lastName}</td>
                    <td className="py-2">
                      <Badge variant={d.score >= 80 ? "default" : d.score >= 50 ? "secondary" : "destructive"}>
                        {d.score}
                      </Badge>
                    </td>
                    <td className="py-2 text-center">{d.overspeedCount}</td>
                    <td className="py-2 text-center">{d.harshBrakingCount}</td>
                    <td className="py-2 text-center">{d.harshAccelerationCount}</td>
                    <td className="py-2 text-center">{d.sosCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeviceSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <DeviceSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offline Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.offlineCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Battery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{data.lowBatteryCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Signal Strength</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.avgSignalStrength ?? 0).toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Device Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Vehicle</th>
                  <th className="pb-2 font-medium">IMEI</th>
                  <th className="pb-2 font-medium">Last Seen</th>
                  <th className="pb-2 font-medium">Battery</th>
                  <th className="pb-2 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody>
                {(data.deviceDetails ?? []).map((d: any) => (
                  <tr key={d.deviceId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{d.vehiclePlate}</td>
                    <td className="py-2 text-muted-foreground">{d.imei}</td>
                    <td className="py-2">{new Date(d.lastSeen).toLocaleString()}</td>
                    <td className="py-2">{d.batteryV != null ? `${d.batteryV}V` : "—"}</td>
                    <td className="py-2">
                      {d.gsmSignal != null ? (
                        <Badge variant={d.gsmSignal > 15 ? "default" : d.gsmSignal > 5 ? "secondary" : "destructive"}>
                          {d.gsmSignal}
                        </Badge>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function AnalyticsView() {
  const { user } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return { from: monday, to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
  });
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [vehicles, setVehicles] = useState<Array<{ id: string; plateNumber: string }>>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState<Record<string, boolean>>({
    overview: true, heatmap: true, speed: true, stoppage: true, geofence: true, driver: true, device: true,
  });
  const [data, setData] = useState<Record<string, any>>({});

  useEffect(() => {
    api.vehicles.list().then((list) => {
      setVehicles(list.map((v) => ({ id: v.id, plateNumber: v.plateNumber })));
    }).catch(() => {});
  }, []);

  const fetchSection = useCallback(async (section: string) => {
    setLoading((prev) => ({ ...prev, [section]: true }));
    try {
      const from = dateRange.from.toISOString();
      const to = dateRange.to.toISOString();
      const vParam = vehicleId !== "all" ? `&vehicleId=${vehicleId}` : "";
      const sectionMap: Record<string, () => Promise<any>> = {
        overview: () => api.analytics.overview(from, to, vParam),
        heatmap: () => api.analytics.eventHeatmap(from, to, vParam),
        speed: () => api.analytics.speedAnalysis(from, to, vParam),
        stoppage: () => api.analytics.stoppageIntel(from, to, vParam),
        geofence: () => api.analytics.geofenceViolations(from, to, vParam),
        driver: () => api.analytics.driverScores(from, to, vParam),
        device: () => api.analytics.deviceHealth(from, to, vParam),
      };
      const result = await sectionMap[section]();
      setData((prev) => ({ ...prev, [section]: result }));
    } catch {
      toast.error(`Failed to load ${section}`);
    } finally {
      setLoading((prev) => ({ ...prev, [section]: false }));
    }
  }, [dateRange, vehicleId]);

  useEffect(() => {
    fetchSection(activeTab);
  }, [activeTab, fetchSection]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Forensic Analytics" description="Deep-dive fleet intelligence and behavioral analysis." />
        <div className="flex items-center gap-3">
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="All Vehicles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.plateNumber}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="heatmap">Event Heatmap</TabsTrigger>
          <TabsTrigger value="speed">Speed Analysis</TabsTrigger>
          <TabsTrigger value="stoppage">Stoppage Intel</TabsTrigger>
          <TabsTrigger value="geofence">Geofence</TabsTrigger>
          <TabsTrigger value="driver">Driver Scores</TabsTrigger>
          <TabsTrigger value="device">Device Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewSection data={data.overview} loading={loading.overview} />
        </TabsContent>
        <TabsContent value="heatmap">
          <HeatmapSection data={data.heatmap} loading={loading.heatmap} />
        </TabsContent>
        <TabsContent value="speed">
          <SpeedSection data={data.speed} loading={loading.speed} />
        </TabsContent>
        <TabsContent value="stoppage">
          <StoppageSection data={data.stoppage} loading={loading.stoppage} />
        </TabsContent>
        <TabsContent value="geofence">
          <GeofenceSection data={data.geofence} loading={loading.geofence} />
        </TabsContent>
        <TabsContent value="driver">
          <DriverSection data={data.driver} loading={loading.driver} />
        </TabsContent>
        <TabsContent value="device">
          <DeviceSection data={data.device} loading={loading.device} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
