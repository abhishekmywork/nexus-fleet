"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import type { GPSReading } from "@/lib/auth-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;

function relativeTime(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function TelemetryTable() {
  const [readings, setReadings] = React.useState<GPSReading[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [imeiFilter, setImeiFilter] = React.useState("");
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());

  const load = React.useCallback(
    async (pageNum: number, imei?: string) => {
      setLoading(true);
      try {
        const result = await api.telemetry.readings({
          page: pageNum,
          limit: PAGE_SIZE,
          imei: imei || undefined,
        });
        setReadings(result.data);
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
        setLastRefresh(new Date());
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    load(page, imeiFilter);
  }, [page, load, imeiFilter]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      load(page, imeiFilter);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, page, imeiFilter, load]);

  const handleSearch = () => {
    setPage(1);
    load(1, imeiFilter);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Telemetry Monitor</CardTitle>
          <CardDescription>
            {total} total readings · live GPS tracking data
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by IMEI..."
              value={imeiFilter}
              onChange={(e) => setImeiFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-9 w-48 rounded-lg pl-9"
            />
          </div>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw
              className={`mr-2 size-4 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Live" : "Auto"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-nowrap">Time</TableHead>
                <TableHead className="whitespace-nowrap">IMEI</TableHead>
                <TableHead className="whitespace-nowrap">Lat</TableHead>
                <TableHead className="whitespace-nowrap">Lon</TableHead>
                <TableHead className="whitespace-nowrap">Speed</TableHead>
                <TableHead className="whitespace-nowrap">Heading</TableHead>
                <TableHead className="whitespace-nowrap">Ignition</TableHead>
                <TableHead className="whitespace-nowrap">Movement</TableHead>
                <TableHead className="whitespace-nowrap">Odometer</TableHead>
                <TableHead className="whitespace-nowrap">Temp</TableHead>
                <TableHead className="whitespace-nowrap">Battery</TableHead>
                <TableHead className="whitespace-nowrap">GSM</TableHead>
                <TableHead className="whitespace-nowrap">Source</TableHead>
                <TableHead className="whitespace-nowrap">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={14} className="h-24 text-center">
                    <Loader2
                      className="mx-auto size-5 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && readings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={14}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No telemetry data found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                readings.map((r) => (
                  <TableRow key={r.id} className="text-xs">
                    <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                      {relativeTime(r.timestamp)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.deviceId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.latitude != null ? Number(r.latitude).toFixed(6) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.longitude != null ? Number(r.longitude).toFixed(6) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.speed != null ? `${Number(r.speed).toFixed(1)}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.heading != null ? `${r.heading}°` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.ignition === "ON" ? "success" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {r.ignition ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.movement === "STOPPED"
                            ? "secondary"
                            : r.movement === "MOVING"
                              ? "success"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {r.movement ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.odometerKm != null ? `${Number(r.odometerKm).toFixed(1)}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.temperatureC != null ? `${Number(r.temperatureC).toFixed(1)}°` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.batteryV != null ? `${Number(r.batteryV).toFixed(2)}V` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {r.gsmSignal != null ? `${r.gsmSignal}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.source ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} readings
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
