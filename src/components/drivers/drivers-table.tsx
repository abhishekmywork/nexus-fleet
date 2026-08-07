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
import { ImportDialog } from "@/components/common/import-dialog";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AuditLog, Driver, Vehicle } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  DriverFormDialog,
  type DriverFormValues,
} from "@/components/drivers/driver-form-dialog";
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

type SortKey = "name" | "phone" | "vehicle";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

function fullName(driver: Driver) {
  return `${driver.firstName} ${driver.lastName}`.trim();
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
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

export function DriversTable() {
  const { can } = useAuth();
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Driver | null>(null);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">(
    "create"
  );
  const [editingDriver, setEditingDriver] = React.useState<Driver | null>(
    null
  );
  const [activeTab, setActiveTab] = React.useState<"active" | "log">("active");
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);

  const loadLogs = React.useCallback(async () => {
    try {
      const data = await api.auditLogs.list({ entityType: "vehicle_driver" });
      setLogs(data);
    } catch {
      // silent
    }
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [driverList, vehicleList] = await Promise.all([
        api.drivers.list(),
        api.vehicles.list(),
      ]);
      setDrivers(driverList);
      setVehicles(vehicleList);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load drivers"
      );
    } finally {
      setLoading(false);
    }
    loadLogs();
  }, [loadLogs]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [driverList, vehicleList] = await Promise.all([
          api.drivers.list(),
          api.vehicles.list(),
        ]);
        if (cancelled) return;
        setDrivers(driverList);
        setVehicles(vehicleList);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load drivers"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    api.auditLogs
      .list({ entityType: "vehicle_driver" })
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canCreate = can("drivers:create");
  const canUpdate = can("drivers:update");
  const canDelete = can("drivers:delete");

  // ---- Derived data: filter, sort, paginate ----
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...drivers]
      .filter(
        (d) =>
          !q ||
          fullName(d).toLowerCase().includes(q) ||
          d.licenseNumber.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let av: string;
        let bv: string;
        if (sortKey === "name") {
          av = fullName(a).toLowerCase();
          bv = fullName(b).toLowerCase();
        } else if (sortKey === "vehicle") {
          av = a.vehicle?.plateNumber?.toLowerCase() ?? "";
          bv = b.vehicle?.plateNumber?.toLowerCase() ?? "";
        } else {
          av = a.phone?.toLowerCase() ?? "";
          bv = b.phone?.toLowerCase() ?? "";
        }
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    return sorted;
  }, [drivers, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ---- CRUD actions ----
  const handleCreate = async (values: DriverFormValues) => {
    setSaving(true);
    try {
      await api.drivers.create({
        firstName: values.firstName,
        lastName: values.lastName,
        licenseNumber: values.licenseNumber,
        phone: values.phone || undefined,
        vehicleId: values.vehicleId || undefined,
      });
      toast.success("Driver created");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create driver"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: DriverFormValues) => {
    if (!editingDriver) return;
    setSaving(true);
    try {
      await api.drivers.update(editingDriver.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        licenseNumber: values.licenseNumber,
        phone: values.phone || undefined,
        vehicleId: values.vehicleId || undefined,
      });
      toast.success("Driver updated");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update driver"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (driver: Driver) => {
    try {
      await api.drivers.remove(driver.id);
      toast.success("Driver deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete driver"
      );
    }
  };

  const handleSave = (values: DriverFormValues) => {
    if (dialogMode === "edit") {
      handleUpdate(values);
    } else {
      handleCreate(values);
    }
  };

const handleExport = async () => {
  try {
    await api.drivers.export();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Export failed");
  }
};

const handleSample = async () => {
  try {
    await api.drivers.sample();
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
          <CardTitle>Drivers</CardTitle>
          <CardDescription>
            {drivers.length} total drivers · manage assignments and profiles.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {can("drivers:read") && (
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
          {can("drivers:create") && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 size-4" aria-hidden="true" />
              Import
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setDialogMode("create");
                setEditingDriver(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Add New
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
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
                  placeholder="Search name, license or phone…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg pl-9"
                  aria-label="Search drivers"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>
                      <SortHeader
                        column="name"
                        active={sortKey === "name"}
                        onClick={toggleSort}
                      >
                        Name
                      </SortHeader>
                    </TableHead>
                    <TableHead>License Number</TableHead>
                    <TableHead>
                      <SortHeader
                        column="phone"
                        active={sortKey === "phone"}
                        onClick={toggleSort}
                      >
                        Phone
                      </SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        column="vehicle"
                        active={sortKey === "vehicle"}
                        onClick={toggleSort}
                      >
                        Vehicle
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
                      <TableCell colSpan={5} className="h-24 text-center">
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
                        colSpan={5}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        No drivers match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <span className="font-medium">{fullName(driver)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {driver.licenseNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {driver.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {driver.vehicle?.plateNumber ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(canUpdate || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                aria-label={`Actions for ${fullName(driver)}`}
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
                                  onClick={() => {
                                    setDialogMode("edit");
                                    setEditingDriver(driver);
                                    setDialogOpen(true);
                                  }}
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
                                  onClick={() => setDeleteTarget(driver)}
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

          <TabsContent value="log">
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
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
                        colSpan={5}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        No audit log entries found.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {timeAgo(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action === "assigned"
                              ? "success"
                              : "destructive"
                          }
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.relatedName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.entityName ?? "—"}
                      </TableCell>
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
        <DriverFormDialog
          driver={dialogMode === "edit" ? editingDriver : null}
          vehicles={vehicles}
          pending={saving}
          onClose={() => {
            if (!saving) setDialogOpen(false);
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete driver?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold">
                {deleteTarget ? fullName(deleteTarget) : ""}
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

      {can("drivers:create") && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          title="Drivers"
          onImported={load}
          parseExcelFile={parseExcelFile}
          validateImport={api.drivers.validateImport}
          confirmImport={api.drivers.confirmImport}
        />
      )}
    </Card>
  );
}
