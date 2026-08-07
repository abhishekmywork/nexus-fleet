"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Event, EventType } from "@/lib/auth-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  IDLE: "Idle",
  STOPPAGE: "Stoppage",
  OVERSPEED: "Overspeed",
  GEOFENCE_OUT: "Geofence Exit",
  GEOFENCE_IN: "Geofence Entry",
  TOW_AWAY: "Tow Away",
  POWER_CUT: "Power Cut",
  LOW_BATTERY: "Low Battery",
  HARSH_BRAKING: "Harsh Braking",
  HARSH_ACCELERATION: "Harsh Accel",
  SOS: "SOS",
  IGNITION_ON: "Ignition On",
  IGNITION_OFF: "Ignition Off",
  DEVICE_OFFLINE: "Offline",
};

const EVENT_SEVERITY: Record<EventType, "destructive" | "warning" | "default"> = {
  IDLE: "default",
  STOPPAGE: "default",
  OVERSPEED: "warning",
  GEOFENCE_OUT: "warning",
  GEOFENCE_IN: "default",
  TOW_AWAY: "destructive",
  POWER_CUT: "destructive",
  LOW_BATTERY: "warning",
  HARSH_BRAKING: "warning",
  HARSH_ACCELERATION: "warning",
  SOS: "destructive",
  IGNITION_ON: "default",
  IGNITION_OFF: "default",
  DEVICE_OFFLINE: "destructive",
};

function relativeTime(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - start;
  if (diffMs < 0) return "—";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  if (hours < 24) return `${hours}h ${remainMin}m`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

function vehicleLabel(event: Event): string {
  const v = event.device?.vehicle;
  if (v) return `${v.plateNumber} (${v.make} ${v.model})`;
  const imei = event.device?.imei;
  if (imei) return `Device ${imei}`;
  return event.deviceId.slice(0, 8) + "...";
}

export function EventsTable() {
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>("all");
  const [ackFilter, setAckFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stats, setStats] = React.useState<Record<string, number>>({});

  const load = React.useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const result = await api.events.list({
          page: pageNum,
          limit: PAGE_SIZE,
          eventType: eventTypeFilter !== "all" ? eventTypeFilter : undefined,
          acknowledged:
            ackFilter === "acknowledged"
              ? true
              : ackFilter === "unacknowledged"
                ? false
                : undefined,
        });
        setEvents(result.data);
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [eventTypeFilter, ackFilter]
  );

  const loadStats = React.useCallback(async () => {
    try {
      const s = await api.events.stats();
      setStats(s);
    } catch {
      // silent
    }
  }, []);

  React.useEffect(() => {
    load(page);
  }, [page, load]);

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.events.acknowledge(id);
      toast.success("Event acknowledged");
      load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
    }
  };

  const filteredEvents = React.useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.eventType.toLowerCase().includes(q) ||
        e.device?.vehicle?.plateNumber?.toLowerCase().includes(q) ||
        e.device?.imei?.includes(q)
    );
  }, [events, searchQuery]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            {total} total events · detected from telemetry data
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search vehicle or IMEI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-48 rounded-lg pl-9"
            />
          </div>
          <Select
            value={eventTypeFilter}
            onValueChange={(v) => {
              setEventTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ackFilter}
            onValueChange={(v) => {
              setAckFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="unacknowledged">Pending</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats bar */}
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(stats)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <Badge
                key={type}
                variant={EVENT_SEVERITY[type as EventType] === "destructive" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {EVENT_TYPE_LABELS[type as EventType] ?? type}: {count}
              </Badge>
            ))}
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-nowrap">Vehicle</TableHead>
                <TableHead className="whitespace-nowrap">Event</TableHead>
                <TableHead className="whitespace-nowrap">Started</TableHead>
                <TableHead className="whitespace-nowrap">Duration</TableHead>
                <TableHead className="whitespace-nowrap">Lat</TableHead>
                <TableHead className="whitespace-nowrap">Lon</TableHead>
                <TableHead className="whitespace-nowrap">Speed</TableHead>
                <TableHead className="whitespace-nowrap">Details</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <Loader2
                      className="mx-auto size-5 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredEvents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No events found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredEvents.map((event) => (
                  <TableRow
                    key={event.id}
                    className={event.acknowledged ? "opacity-60" : ""}
                  >
                    <TableCell className="whitespace-nowrap text-sm font-medium">
                      {vehicleLabel(event)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={EVENT_SEVERITY[event.eventType]}
                        className="text-[10px]"
                      >
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {relativeTime(event.startedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {event.endedAt ? (
                        formatDuration(event.startedAt, event.endedAt)
                      ) : (
                        <span className="text-primary">ongoing</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {event.latitude != null
                        ? Number(event.latitude).toFixed(5)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {event.longitude != null
                        ? Number(event.longitude).toFixed(5)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {event.speed != null
                        ? `${Number(event.speed).toFixed(1)} kph`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {event.metadata
                        ? Object.entries(event.metadata)
                            .filter(([k]) => k !== "ruleName")
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {event.acknowledged ? (
                        <Badge variant="secondary" className="text-[10px]">
                          <CheckCircle2 className="mr-1 size-3" />
                          Acked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          <AlertTriangle className="mr-1 size-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!event.acknowledged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleAcknowledge(event.id)}
                        >
                          Ack
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} events
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
