"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Radio,
  RefreshCw,
  ServerCog,
  Signal,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type {
  OpsDevice,
  OpsDevices,
  OpsIngest,
  OpsIntegrity,
  OpsOrphans,
  OpsVolume,
} from "@/lib/auth-types";

const REFRESH_MS = 60_000;

function formatAge(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<
  OpsIngest["status"],
  { label: string; variant: "success" | "warning" | "destructive"; className: string }
> = {
  healthy: {
    label: "Healthy",
    variant: "success",
    className: "border-success/30 bg-success/5",
  },
  degraded: {
    label: "Degraded",
    variant: "warning",
    className: "border-warning/40 bg-warning/5",
  },
  critical: {
    label: "Critical",
    variant: "destructive",
    className: "border-destructive/40 bg-destructive/5",
  },
};

const DEVICE_STATUS: Record<
  OpsDevice["status"],
  { label: string; variant: "success" | "warning" | "destructive" | "outline" }
> = {
  online: { label: "Online", variant: "success" },
  stale: { label: "Stale", variant: "warning" },
  offline: { label: "Offline", variant: "destructive" },
  never: { label: "Never reported", variant: "outline" },
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "warning" | "danger";
  loading?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";

  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start gap-4 p-4">
        <div className={`rounded-lg p-2.5 ${toneClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="mb-1 h-7 w-16" />
          ) : (
            <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
          )}
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OpsHealthView() {
  const { user } = useAuth();
  const isSuper = !!user?.isSuperUser;

  const [ingest, setIngest] = React.useState<OpsIngest | null>(null);
  const [volume, setVolume] = React.useState<OpsVolume | null>(null);
  const [orphans, setOrphans] = React.useState<OpsOrphans | null>(null);
  const [integrity, setIntegrity] = React.useState<OpsIntegrity | null>(null);
  const [devices, setDevices] = React.useState<OpsDevices | null>(null);

  const [loadingInfra, setLoadingInfra] = React.useState(isSuper);
  const [loadingDevices, setLoadingDevices] = React.useState(true);
  const [volumeHours, setVolumeHours] = React.useState(24);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadDevices = React.useCallback(() => {
    setLoadingDevices(true);
    return api.ops
      .devices()
      .then(setDevices)
      .catch(() => toast.error("Failed to load device health"))
      .finally(() => setLoadingDevices(false));
  }, []);

  const loadInfra = React.useCallback(() => {
    if (!isSuper) {
      setLoadingInfra(false);
      return Promise.resolve();
    }
    setLoadingInfra(true);
    return Promise.all([api.ops.ingest(), api.ops.orphans(), api.ops.integrity()])
      .then(([i, o, g]) => {
        setIngest(i);
        setOrphans(o);
        setIntegrity(g);
      })
      .catch(() => toast.error("Failed to load pipeline health"))
      .finally(() => setLoadingInfra(false));
  }, [isSuper]);

  React.useEffect(() => {
    void loadInfra();
    void loadDevices();
  }, [loadInfra, loadDevices]);

  React.useEffect(() => {
    if (!isSuper) return;
    api.ops
      .volume(volumeHours)
      .then(setVolume)
      .catch(() => toast.error("Failed to load ingestion volume"));
  }, [isSuper, volumeHours]);

  React.useEffect(() => {
    const id = setInterval(() => {
      void loadInfra();
      void loadDevices();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadInfra, loadDevices]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadInfra(), loadDevices()]);
    if (isSuper) {
      await api.ops
        .volume(volumeHours)
        .then(setVolume)
        .catch(() => undefined);
    }
    setRefreshing(false);
  };

  const status = ingest?.status ?? "healthy";
  const statusStyle = STATUS_STYLE[status];
  const discardTotal = ingest?.discards.total ?? 0;

  const volumeMax = React.useMemo(
    () => Math.max(1, ...(volume?.series.map((p) => p.count) ?? [1])),
    [volume],
  );

  const deviceSummary = devices?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Telemetry pipeline, device coverage and data-quality signals."
        actions={
          <>
            {ingest?.generatedAt && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated {formatDateTime(ingest.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={refreshing}
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      {/* ---------------------------------------------------- pipeline */}
      {isSuper && (
        <>
          <Card className={`shadow-sm ${statusStyle.className}`}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {status === "healthy" ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : (
                  <AlertTriangle
                    className={`size-5 ${
                      status === "critical" ? "text-destructive" : "text-warning"
                    }`}
                  />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    Ingest pipeline is {statusStyle.label.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ingest
                      ? `${ingest.consumers.length} consumer${
                          ingest.consumers.length === 1 ? "" : "s"
                        } · lag ${ingest.group.lag ?? "—"} · ${ingest.group.pending} pending`
                      : "Loading pipeline state…"}
                  </p>
                </div>
              </div>
              <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Stream entries"
              value={(ingest?.stream.length ?? 0).toLocaleString()}
              hint="gps:telemetry:stream (MAXLEN ~100k)"
              icon={Database}
              loading={loadingInfra}
            />
            <StatCard
              label="Consumer lag"
              value={ingest?.group.lag ?? 0}
              hint="entries written but not yet read"
              icon={Activity}
              tone={(ingest?.group.lag ?? 0) > 500 ? "warning" : "default"}
              loading={loadingInfra}
            />
            <StatCard
              label="Pending (PEL)"
              value={(ingest?.group.pending ?? 0).toLocaleString()}
              hint="delivered but not acknowledged"
              icon={HardDrive}
              tone={(ingest?.group.pending ?? 0) > 500 ? "danger" : "default"}
              loading={loadingInfra}
            />
            <StatCard
              label="Newest packet"
              value={formatAge(ingest?.stream.lastEntryAgeMs ?? null)}
              hint="age of the last stream entry"
              icon={Clock}
              tone={(ingest?.stream.lastEntryAgeMs ?? 0) > 120_000 ? "danger" : "default"}
              loading={loadingInfra}
            />
          </div>
        </>
      )}

      {/* ------------------------------------------- volume + discards */}
      {isSuper && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Ingestion volume</CardTitle>
                <CardDescription>
                  Readings stored per hour
                  {volume ? ` · ${volume.total.toLocaleString()} total` : ""}
                </CardDescription>
              </div>
              <div className="flex gap-1">
                {[24, 48, 168].map((h) => (
                  <Button
                    key={h}
                    size="sm"
                    variant={volumeHours === h ? "default" : "outline"}
                    onClick={() => setVolumeHours(h)}
                  >
                    {h === 168 ? "7d" : `${h}h`}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {!volume ? (
                <Skeleton className="h-40 w-full" />
              ) : volume.series.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No readings in this window.
                </p>
              ) : (
                <div>
                  <div className="flex h-40 items-end gap-1">
                    {volume.series.map((point) => (
                      <div
                        key={point.hour}
                        className="flex h-full flex-1 items-end"
                        title={`${formatHour(point.hour)} — ${point.count.toLocaleString()} readings`}
                      >
                        <div
                          className="w-full rounded-t bg-primary/70 transition-colors hover:bg-primary"
                          style={{
                            height: `${Math.max(2, (point.count / volumeMax) * 100)}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{formatHour(volume.series[0].hour)}</span>
                    <span>
                      {formatHour(volume.series[volume.series.length - 1].hour)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Discarded packets</CardTitle>
              <CardDescription>
                Dropped today · {discardTotal.toLocaleString()} total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ["Invalid GPS fix", ingest?.discards.invalid_fix ?? 0],
                  ["Unknown IMEI", ingest?.discards.unknown_imei ?? 0],
                  ["Missing fields", ingest?.discards.missing_fields ?? 0],
                  ["Malformed", ingest?.discards.malformed ?? 0],
                ] as const
              ).map(([label, count]) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{
                        width: `${discardTotal ? Math.round((count / discardTotal) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Skipped packets are acknowledged and never stored — this is
                expected traffic, not data loss.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------------- orphans + integrity */}
      {isSuper && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="size-4" />
                Unregistered trackers
              </CardTitle>
              <CardDescription>
                IMEIs sending packets with no matching device record
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!orphans ? (
                <Skeleton className="h-16 w-full" />
              ) : orphans.orphans.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Every IMEI hitting the ingest is registered.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IMEI</TableHead>
                      <TableHead className="text-right">Packets</TableHead>
                      <TableHead>First seen</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead>Last position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphans.orphans.map((o) => (
                      <TableRow key={o.imei}>
                        <TableCell className="font-mono text-xs">{o.imei}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.packets.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(o.firstSeen)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(o.lastSeen)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.latitude != null && o.longitude != null
                            ? `${o.latitude.toFixed(5)}, ${o.longitude.toFixed(5)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ServerCog className="size-4" />
                Integrity
              </CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Readings stored</span>
                <span className="font-semibold tabular-nums">
                  {(integrity?.totalReadings ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Duplicate readings
                </span>
                <Badge
                  variant={(integrity?.duplicates ?? 0) > 0 ? "warning" : "success"}
                >
                  {(integrity?.duplicates ?? 0).toLocaleString()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Cleaning backlog
                </span>
                <Badge
                  variant={
                    (integrity?.unprocessedBacklog ?? 0) > 1000
                      ? "warning"
                      : "success"
                  }
                >
                  {(integrity?.unprocessedBacklog ?? 0).toLocaleString()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --------------------------------------------------- devices */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Signal className="size-4" />
            Device data quality
          </CardTitle>
          <CardDescription>
            Every registered tracker, including devices with no vehicle linked
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deviceSummary && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="success">{deviceSummary.online} online</Badge>
              <Badge variant="warning">{deviceSummary.stale} stale</Badge>
              <Badge variant="destructive">{deviceSummary.offline} offline</Badge>
              <Badge variant="outline">{deviceSummary.never} never reported</Badge>
              {deviceSummary.unlinked > 0 && (
                <Badge variant="info">
                  {deviceSummary.unlinked} without a vehicle
                </Badge>
              )}
            </div>
          )}

          {loadingDevices && !devices ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !devices || devices.devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No GPS devices registered yet.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Serial</TableHead>
                    {isSuper && <TableHead>Tenant</TableHead>}
                    <TableHead>Last seen</TableHead>
                    <TableHead className="text-right">24h</TableHead>
                    <TableHead className="text-right">Battery</TableHead>
                    <TableHead className="text-right">Signal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.devices.map((device) => {
                    const style = DEVICE_STATUS[device.status];
                    return (
                      <TableRow key={device.deviceId}>
                        <TableCell>
                          <Badge variant={style.variant}>{style.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {device.plateNumber ?? (
                            <span className="text-muted-foreground">Unlinked</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {device.imei}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {device.serialNumber ?? "—"}
                        </TableCell>
                        {isSuper && (
                          <TableCell className="text-xs text-muted-foreground">
                            {device.tenantName ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {device.lastSeen ? (
                            <span title={formatDateTime(device.lastSeen)}>
                              {formatAge(device.ageMs)} ago
                            </span>
                          ) : (
                            "never"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {device.readings24h.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={
                              device.batteryV != null && device.batteryV < 3.5
                                ? "font-medium text-destructive"
                                : ""
                            }
                          >
                            {device.batteryV != null
                              ? `${device.batteryV.toFixed(1)}V`
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {device.gsmSignal ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isSuper && (
        <p className="text-xs text-muted-foreground">
          Pipeline diagnostics are visible to system administrators only.
        </p>
      )}
    </div>
  );
}
