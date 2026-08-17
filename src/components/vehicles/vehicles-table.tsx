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
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AuditLog, ServingArea, Vehicle } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  VehicleFormDialog,
  type VehicleFormValues,
} from "@/components/vehicles/vehicle-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ImportDialog } from "@/components/common/import-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type SortKey = "plateNumber" | "make" | "year" | "status" | "driver" | "areas";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

const STATUS_VARIANTS: Record<
  Vehicle["status"],
  "success" | "secondary" | "warning"
> = {
  active: "success",
  inactive: "secondary",
  maintenance: "warning",
};

function vehicleLabel(v: Vehicle) {
  return `${v.make} ${v.model}`.trim();
}

function driverName(v: Vehicle) {
  if (!v.driver) return "—";
  return `${v.driver.firstName} ${v.driver.lastName}`.trim();
}

function gpsLabel(v: Vehicle) {
  if (!v.gpsDevice) return "—";
  return v.gpsDevice.imei;
}

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

interface SortHeaderProps {
  column: SortKey;
  active: boolean;
  onClick: (column: SortKey) => void;
  children: React.ReactNode;
}

function SortHeader({ column, active, onClick, children }: SortHeaderProps) {
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

export function VehiclesTable() {
  const { can, user } = useAuth();
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [trashVehicles, setTrashVehicles] = React.useState<Vehicle[]>([]);
  const [servingAreas, setServingAreas] = React.useState<ServingArea[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("plateNumber");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">(
    "create"
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingVehicle, setEditingVehicle] = React.useState<Vehicle | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = React.useState<Vehicle | null>(null);
  const [activeTab, setActiveTab] = React.useState<"active" | "trash" | "log">("active");
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const [statusToggling, setStatusToggling] = React.useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = React.useState<Vehicle | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = React.useState<Vehicle | null>(null);
  const isSuperAdmin = user?.isSuperUser === true;

  const loadLogs = React.useCallback(async () => {
    try {
      const data = await api.auditLogs.list({ entityType: "vehicle,vehicle_serving_area,vehicle_driver,vehicle_gps_device" });
      setLogs(data);
    } catch {
      // silent
    }
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        api.vehicles.list(),
        api.servingAreas.list(),
      ];
      if (isSuperAdmin) promises.push(api.vehicles.listDeleted());
      const results = await Promise.all(promises);
      setVehicles(results[0]);
      setServingAreas(results[1]);
      if (isSuperAdmin && results[2]) setTrashVehicles(results[2]);
      await loadLogs();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load vehicles"
      );
    } finally {
      setLoading(false);
    }
  }, [loadLogs, isSuperAdmin]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const promises: Promise<any>[] = [
          api.vehicles.list(),
          api.servingAreas.list(),
        ];
        if (isSuperAdmin) promises.push(api.vehicles.listDeleted());
        const results = await Promise.all(promises);
        if (cancelled) return;
        setVehicles(results[0]);
        setServingAreas(results[1]);
        if (isSuperAdmin && results[2]) setTrashVehicles(results[2]);
        await loadLogs();
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load vehicles"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLogs, isSuperAdmin]);

  const canCreate = can("vehicles:create");
  const canUpdate = can("vehicles:update");
  const canDelete = can("vehicles:delete");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...vehicles]
      .filter(
        (v) =>
          !q ||
          v.plateNumber.toLowerCase().includes(q) ||
          vehicleLabel(v).toLowerCase().includes(q) ||
          driverName(v).toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "plateNumber") {
          av = a.plateNumber.toLowerCase();
          bv = b.plateNumber.toLowerCase();
        } else if (sortKey === "make") {
          av = vehicleLabel(a).toLowerCase();
          bv = vehicleLabel(b).toLowerCase();
        } else if (sortKey === "year") {
          av = a.year ?? 0;
          bv = b.year ?? 0;
          return sortDir === "asc"
            ? (av as number) - (bv as number)
            : (bv as number) - (av as number);
        } else if (sortKey === "status") {
          av = a.status;
          bv = b.status;
        } else if (sortKey === "driver") {
          av = driverName(a).toLowerCase();
          bv = driverName(b).toLowerCase();
        } else {
          av = a.servingAreas.length;
          bv = b.servingAreas.length;
          return sortDir === "asc"
            ? (av as number) - (bv as number)
            : (bv as number) - (av as number);
        }
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    return sorted;
  }, [vehicles, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const vehicleMap = React.useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) map.set(v.id, v);
    return map;
  }, [vehicles]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCreate = () => {
    setEditingVehicle(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleSave = async (values: VehicleFormValues) => {
    setSaving(true);
    try {
      if (dialogMode === "edit" && editingVehicle) {
        await api.vehicles.update(editingVehicle.id, {
          plateNumber: values.plateNumber,
          make: values.make,
          model: values.model,
          year: values.year ? Number(values.year) : undefined,
          status: values.status,
          notes: values.notes || undefined,
        });
        await api.vehicles.assignAreas(editingVehicle.id, values.servingAreaIds);
        toast.success("Vehicle updated");
      } else {
        await api.vehicles.create({
          plateNumber: values.plateNumber,
          make: values.make,
          model: values.model,
          year: values.year ? Number(values.year) : undefined,
          status: values.status,
          notes: values.notes || undefined,
          servingAreaIds: values.servingAreaIds,
        });
        toast.success("Vehicle created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save vehicle"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    try {
      await api.vehicles.remove(vehicle.id);
      toast.success("Vehicle moved to trash");
      setDeleteTarget(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(vehicle.id);
        return next;
      });
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete vehicle"
      );
    }
  };

  const handleBulkDelete = async () => {
    setSaving(true);
    try {
      for (const id of selected) {
        await api.vehicles.remove(id);
      }
      toast.success(`${selected.size} vehicle(s) moved to trash`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete vehicles"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (vehicle: Vehicle) => {
    try {
      await api.vehicles.restore(vehicle.id);
      toast.success("Vehicle restored");
      setRestoreTarget(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore vehicle"
      );
    }
  };

  const handlePermanentDelete = async (vehicle: Vehicle) => {
    try {
      await api.vehicles.permanentDelete(vehicle.id);
      toast.success("Vehicle permanently deleted");
      setPermDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to permanently delete vehicle"
      );
    }
  };

  const handleStatusChange = async (vehicle: Vehicle, status: Vehicle["status"]) => {
    setStatusToggling(vehicle.id);
    try {
      await api.vehicles.update(vehicle.id, { status });
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, status } : v))
      );
      toast.success(`Status changed to ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusToggling(null);
    }
  };

const handleExport = async () => {
  try {
    await api.vehicles.export();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Export failed");
  }
};

const handleSample = async () => {
  try {
    await api.vehicles.sample();
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
          <CardTitle>Vehicles</CardTitle>
          <CardDescription>
            {vehicles.length} active vehicles{isSuperAdmin && trashVehicles.length > 0 ? ` · ${trashVehicles.length} in trash` : ""} · manage fleet and service areas.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {can("vehicles:read") && (
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
          {can("vehicles:create") && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 size-4" aria-hidden="true" />
              Import
            </Button>
          )}
          {canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Add New
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "trash" | "log")}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="trash">
                Trash
                {trashVehicles.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {trashVehicles.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
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
                  placeholder="Search plate, make, or driver…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg pl-9"
                  aria-label="Search vehicles"
                />
              </div>

              {canDelete && selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-7 px-2.5">
                    {selected.size} selected
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9"
                    onClick={handleBulkDelete}
                    disabled={saving}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[48px]">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        column="plateNumber"
                        active={sortKey === "plateNumber"}
                        onClick={toggleSort}
                      >
                        Plate
                      </SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        column="make"
                        active={sortKey === "make"}
                        onClick={toggleSort}
                      >
                        Make / Model
                      </SortHeader>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <SortHeader
                        column="year"
                        active={sortKey === "year"}
                        onClick={toggleSort}
                      >
                        Year
                      </SortHeader>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <SortHeader
                        column="status"
                        active={sortKey === "status"}
                        onClick={toggleSort}
                      >
                        Status
                      </SortHeader>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <SortHeader
                        column="driver"
                        active={sortKey === "driver"}
                        onClick={toggleSort}
                      >
                        Driver
                      </SortHeader>
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      GPS Device
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <SortHeader
                        column="areas"
                        active={sortKey === "areas"}
                        onClick={toggleSort}
                      >
                        Areas
                      </SortHeader>
                    </TableHead>
                    <TableHead className="w-[50px] text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <Loader2
                          className="mx-auto size-5 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        No vehicles match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((vehicle) => (
                    <TableRow
                      key={vehicle.id}
                      className={cn(selected.has(vehicle.id) && "bg-accent/40")}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(vehicle.id)}
                          onCheckedChange={(checked) =>
                            toggleOne(vehicle.id, checked === true)
                          }
                          aria-label={`Select ${vehicle.plateNumber}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {vehicle.plateNumber}
                      </TableCell>
                      <TableCell>{vehicleLabel(vehicle)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {vehicle.year ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {canUpdate ? (
                          <Select
                            value={vehicle.status}
                            onValueChange={(v) =>
                              handleStatusChange(vehicle, v as Vehicle["status"])
                            }
                            disabled={statusToggling === vehicle.id}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-7 w-[110px] text-xs capitalize",
                                vehicle.status === "active" && "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400",
                                vehicle.status === "inactive" && "border-muted bg-muted/50 text-muted-foreground",
                                vehicle.status === "maintenance" && "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={STATUS_VARIANTS[vehicle.status]}
                            className="capitalize"
                          >
                            {vehicle.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {driverName(vehicle)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">
                        {gpsLabel(vehicle)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {vehicle.servingAreas.length}
                      </TableCell>
                      <TableCell className="text-right">
                        {(canUpdate || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                aria-label={`Actions for ${vehicle.plateNumber}`}
                              >
                                <MoreHorizontal
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {canUpdate && (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleEdit(vehicle)}
                                >
                                  <Pencil
                                    className="mr-2 size-4"
                                    aria-hidden="true"
                                  />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(vehicle)}
                                >
                                  <Trash2
                                    className="mr-2 size-4"
                                    aria-hidden="true"
                                  />
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

          <TabsContent value="trash" className="space-y-4">
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Plate</TableHead>
                    <TableHead>Make / Model</TableHead>
                    <TableHead className="hidden md:table-cell">Year</TableHead>
                    <TableHead className="hidden lg:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Deleted</TableHead>
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
                  {!loading && trashVehicles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        No deleted vehicles.
                      </TableCell>
                    </TableRow>
                  )}
                  {trashVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                      <TableCell>{vehicleLabel(vehicle)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {vehicle.year ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={STATUS_VARIANTS[vehicle.status]} className="capitalize">
                          {vehicle.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {vehicle.deletedAt ? relativeTime(vehicle.deletedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => setRestoreTarget(vehicle)}
                            >
                              <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-destructive focus:text-destructive"
                              onClick={() => setPermDeleteTarget(vehicle)}
                            >
                              <Trash2 className="mr-2 size-4" aria-hidden="true" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="log">
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
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
                  {logs.map((log) => {
                    const vehicle = vehicleMap.get(log.entityId);
                    const actionColor =
                      log.action === "assigned" || log.action === "restored" || log.action === "created"
                        ? "success"
                        : log.action === "permanently_deleted"
                          ? "destructive"
                          : "secondary";
                    const typeLabel =
                      log.entityType === "vehicle"
                        ? "Vehicle"
                        : log.entityType === "vehicle_serving_area"
                          ? "Serving Area"
                          : log.entityType === "vehicle_driver"
                            ? "Driver"
                            : "GPS Device";
                    const details = log.entityName || vehicle?.plateNumber || log.entityId;
                    const extra = log.relatedName ? ` → ${log.relatedName}` : "";
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {relativeTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionColor as any} className="capitalize">
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {typeLabel}
                        </TableCell>
                        <TableCell className="font-medium">
                          {details}{extra}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.actorEmail ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Add / Edit modal */}
      {dialogOpen && (
        <VehicleFormDialog
          vehicle={dialogMode === "edit" ? editingVehicle : null}
          servingAreas={servingAreas}
          pending={saving}
          onClose={() => {
            if (!saving) setDialogOpen(false);
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation (soft delete) */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move{" "}
              <span className="font-semibold">
                {deleteTarget ? deleteTarget.plateNumber : ""}
              </span>{" "}
              to trash. You can restore it later from the Trash tab.
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

      {/* Restore confirmation */}
      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore{" "}
              <span className="font-semibold">
                {restoreTarget ? restoreTarget.plateNumber : ""}
              </span>{" "}
              back to the active fleet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => restoreTarget && handleRestore(restoreTarget)}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete confirmation */}
      <AlertDialog
        open={permDeleteTarget !== null}
        onOpenChange={(o) => !o && setPermDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold">
                {permDeleteTarget ? permDeleteTarget.plateNumber : ""}
              </span>{" "}
              and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => permDeleteTarget && handlePermanentDelete(permDeleteTarget)}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import dialog */}
      {can("vehicles:create") && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          title="Vehicles"
          onImported={load}
          parseExcelFile={parseExcelFile}
          validateImport={api.vehicles.validateImport}
          confirmImport={api.vehicles.confirmImport}
        />
      )}
    </Card>
  );
}
