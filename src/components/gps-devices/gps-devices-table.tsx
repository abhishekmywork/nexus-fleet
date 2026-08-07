"use client";

import * as React from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AuditLog, GPSDevice, Vehicle } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  GPSDeviceFormDialog,
  type GPSDeviceFormValues,
} from "@/components/gps-devices/gps-device-form-dialog";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ImportDialog } from "@/components/common/import-dialog";
import * as XLSX from "xlsx";

type SortKey = "imei" | "model" | "serialNumber" | "vehicle";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function SortHeader({
  column,
  active,
  onClick,
  children,
}: {
  column: SortKey;
  active: boolean;
  onClick: (column: SortKey) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(column)}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground",
        active && "text-foreground"
      )}
      aria-label={`Sort by ${children}`}
    >
      {children}
      <ArrowUpDown className="size-3.5 opacity-60" aria-hidden="true" />
    </button>
  );
}

export function GPSDevicesTable() {
  const { can } = useAuth();
  const [devices, setDevices] = React.useState<GPSDevice[]>([]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("imei");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<GPSDevice | null>(null);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [editingDevice, setEditingDevice] = React.useState<GPSDevice | null>(null);
  const [activeTab, setActiveTab] = React.useState<"active" | "log">("active");
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);

  const loadLogs = React.useCallback(async () => {
    try {
      const data = await api.auditLogs.list({ entityType: "vehicle_gps_device" });
      setLogs(data);
    } catch {
      // silent
    }
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [deviceList, vehicleList] = await Promise.all([
        api.gpsDevices.list(),
        api.vehicles.list(),
      ]);
      setDevices(deviceList);
      setVehicles(vehicleList);
      await loadLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load GPS devices");
    } finally {
      setLoading(false);
    }
  }, [loadLogs]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [deviceList, vehicleList] = await Promise.all([
          api.gpsDevices.list(),
          api.vehicles.list(),
        ]);
        if (cancelled) return;
        setDevices(deviceList);
        setVehicles(vehicleList);
        const logData = await api.auditLogs.list({ entityType: "vehicle_gps_device" });
        if (!cancelled) setLogs(logData);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load GPS devices");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canCreate = can("gps_devices:create");
  const canUpdate = can("gps_devices:update");
  const canDelete = can("gps_devices:delete");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...devices]
      .filter(
        (d) =>
          !q ||
          d.imei.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          (d.serialNumber ?? "").toLowerCase().includes(q) ||
          (d.vehicle?.plateNumber ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let av: string;
        let bv: string;
        if (sortKey === "vehicle") {
          av = a.vehicle?.plateNumber ?? "zzz";
          bv = b.vehicle?.plateNumber ?? "zzz";
        } else {
          av = (a[sortKey] ?? "").toString().toLowerCase();
          bv = (b[sortKey] ?? "").toString().toLowerCase();
        }
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    return sorted;
  }, [devices, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleCreate = async (values: GPSDeviceFormValues) => {
    setSaving(true);
    try {
      await api.gpsDevices.create({
        imei: values.imei,
        model: values.model,
        serialNumber: values.serialNumber || undefined,
        vehicleId: values.vehicleId || undefined,
      });
      toast.success("GPS device created");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create GPS device");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: GPSDeviceFormValues) => {
    if (!editingDevice) return;
    setSaving(true);
    try {
      await api.gpsDevices.update(editingDevice.id, {
        imei: values.imei,
        model: values.model,
        serialNumber: values.serialNumber || undefined,
        vehicleId: values.vehicleId || undefined,
      });
      toast.success("GPS device updated");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update GPS device");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device: GPSDevice) => {
    try {
      await api.gpsDevices.remove(device.id);
      toast.success("GPS device deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete GPS device");
    }
  };

const handleExport = async () => {
  try {
    await api.gpsDevices.export();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Export failed");
  }
};

const handleSample = async () => {
  try {
    await api.gpsDevices.sample();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Download failed");
  }
};

  const parseExcelFile = async (file: File): Promise<Record<string, unknown>[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>GPS Devices</CardTitle>
          <CardDescription>
            {devices.length} total devices · manage IMEI, model, and vehicle assignments.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {can("gps_devices:read") && (
            <>
              <Button variant="outline" size="sm" onClick={handleSample}>
                <FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />
                Sample
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 size-4" aria-hidden="true" />
                Export
              </Button>
            </>
          )}
          {can("gps_devices:create") && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 size-4" aria-hidden="true" />
              Import
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setEditingDevice(null);
                setDialogMode("create");
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Add New
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "log")}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search IMEI, model, plate…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg pl-9"
                  aria-label="Search GPS devices"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>
                      <SortHeader column="imei" active={sortKey === "imei"} onClick={toggleSort}>IMEI</SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader column="model" active={sortKey === "model"} onClick={toggleSort}>Model</SortHeader>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <SortHeader column="serialNumber" active={sortKey === "serialNumber"} onClick={toggleSort}>Serial Number</SortHeader>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">SIM No.</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <SortHeader column="vehicle" active={sortKey === "vehicle"} onClick={toggleSort}>Vehicle</SortHeader>
                    </TableHead>
                    <TableHead className="w-[50px] text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        No GPS devices match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.imei}</TableCell>
                      <TableCell>{device.model}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {device.serialNumber ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {device.simNo ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {device.vehicle ? (
                          <span>{device.vehicle.plateNumber}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(canUpdate || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                aria-label={`Actions for device ${device.imei}`}
                              >
                                <MoreHorizontal className="size-4" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {canUpdate && (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setEditingDevice(device);
                                    setDialogMode("edit");
                                    setDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="mr-2 size-4" aria-hidden="true" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(device)}
                                >
                                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {rows.length} of {filtered.length} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={safePage === pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="log">
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                        No log entries yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {relativeTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.action === "assigned" ? "success" : "destructive"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.entityName ?? log.entityId}</TableCell>
                      <TableCell>{log.relatedName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.actorEmail ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Add / Edit modal */}
      {dialogOpen && (
        <GPSDeviceFormDialog
          device={dialogMode === "edit" ? editingDevice : null}
          vehicles={vehicles}
          pending={saving}
          onClose={() => {
            if (!saving) setDialogOpen(false);
          }}
          onSave={dialogMode === "create" ? handleCreate : handleUpdate}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GPS device?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove device{" "}
              <span className="font-semibold">
                {deleteTarget?.imei ?? ""}
              </span>{" "}
              and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {can("gps_devices:create") && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          title="GPS Devices"
          onImported={load}
          parseExcelFile={parseExcelFile}
          validateImport={api.gpsDevices.validateImport}
          confirmImport={api.gpsDevices.confirmImport}
        />
      )}
    </Card>
  );
}
