"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { AuditLog, AuditLogPaginatedResponse } from "@/lib/auth-types";
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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  vehicle_serving_area: "Vehicle Serving Area",
  vehicle_driver: "Vehicle Driver",
  vehicle_gps_device: "Vehicle GPS Device",
  tenant: "Tenant",
  user: "User",
  role: "Role",
  serving_area: "Serving Area",
  geofence: "Geofence",
  event_rule: "Event Rule",
  setting: "Setting",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  assigned: "Assigned",
  unassigned: "Unassigned",
  soft_deleted: "Soft Deleted",
  restored: "Restored",
  permanently_deleted: "Permanently Deleted",
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function actionBadgeVariant(action: string): "success" | "destructive" | "secondary" | "warning" {
  switch (action) {
    case "created":
    case "restored":
    case "assigned":
      return "success";
    case "deleted":
    case "permanently_deleted":
    case "soft_deleted":
      return "destructive";
    case "unassigned":
      return "warning";
    default:
      return "secondary";
  }
}

export function ActivityLogsTable() {
  const [data, setData] = React.useState<AuditLogPaginatedResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [entityType, setEntityType] = React.useState<string>("all");
  const [action, setAction] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const limit = 20;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.auditLogs.list({
        entityType: entityType === "all" ? undefined : entityType,
        action: action === "all" ? undefined : action,
        search: search || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        limit,
      });
      setData(result);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load activity logs"
      );
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, search, dateFrom, dateTo]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const logs = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
        <CardDescription>
          {meta.total} total entries · track all system activity across entities.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1 max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search entity name or actor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-9 rounded-lg pl-9"
              aria-label="Search activity logs"
            />
          </div>

          <Select
            value={entityType}
            onValueChange={(v) => {
              setEntityType(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="All entity types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entity types</SelectItem>
              {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 w-[160px]"
            aria-label="From date"
          />

          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 w-[160px]"
            aria-label="To date"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead className="w-[120px]">Action</TableHead>
                <TableHead className="w-[150px]">Entity Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-[180px]">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2
                      className="mx-auto size-5 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No activity logs found.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                    {relativeTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={actionBadgeVariant(log.action)}
                      className="capitalize"
                    >
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {log.entityName ?? log.entityId}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.relatedName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.actorEmail ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {logs.length} of {meta.total} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {page} / {meta.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
