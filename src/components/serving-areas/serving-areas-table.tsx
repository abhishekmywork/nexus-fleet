"use client";

import * as React from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { ImportDialog } from "@/components/common/import-dialog";
import { api } from "@/lib/api";
import type { ServingArea } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  ServingAreaFormDialog,
  type ServingAreaFormValues,
} from "@/components/serving-areas/serving-area-form-dialog";
import { Button } from "@/components/ui/button";
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
import * as XLSX from "xlsx";

export function ServingAreasTable() {
  const { can } = useAuth();
  const [areas, setAreas] = React.useState<ServingArea[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ServingArea | null>(
    null,
  );
  const [editingArea, setEditingArea] = React.useState<ServingArea | null>(
    null,
  );
  const [importOpen, setImportOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.servingAreas.list();
      setAreas(list);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load serving areas",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.servingAreas.list();
        if (cancelled) return;
        setAreas(list);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load serving areas",
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

  const canCreate = can("serving_areas:create");
  const canUpdate = can("serving_areas:update");
  const canDelete = can("serving_areas:delete");

  const handleCreate = async (values: ServingAreaFormValues) => {
    setSaving(true);
    try {
      await api.servingAreas.create({
        name: values.name,
        description: values.description || undefined,
      });
      toast.success("Serving area created");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create serving area",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: ServingAreaFormValues) => {
    if (!editingArea) return;
    setSaving(true);
    try {
      await api.servingAreas.update(editingArea.id, {
        name: values.name,
        description: values.description || undefined,
      });
      toast.success("Serving area updated");
      setDialogOpen(false);
      setEditingArea(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update serving area",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (area: ServingArea) => {
    try {
      await api.servingAreas.remove(area.id);
      toast.success("Serving area deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete serving area",
      );
    }
  };

  const handleSave = (values: ServingAreaFormValues) => {
    if (editingArea) {
      handleUpdate(values);
    } else {
      handleCreate(values);
    }
  };

const handleExport = async () => {
  try {
    await api.servingAreas.export();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Export failed");
  }
};

const handleSample = async () => {
  try {
    await api.servingAreas.sample();
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
          <CardTitle>Serving Areas</CardTitle>
          <CardDescription>
            {areas.length} serving area{areas.length !== 1 ? "s" : ""} · define
            zones where vehicles operate.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {can("serving_areas:read") && (
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
          {can("serving_areas:create") && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 size-4" aria-hidden="true" />
              Import
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setEditingArea(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Create serving area
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Description
                </TableHead>
                <TableHead className="w-[50px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    <Loader2
                      className="mx-auto size-5 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && areas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    <p className="text-sm text-muted-foreground">
                      No serving areas found.
                    </p>
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell>
                      <p className="truncate font-medium">{area.name}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <p className="truncate text-sm text-muted-foreground">
                        {area.description ?? (
                          <span className="italic">No description</span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {(canUpdate || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              aria-label={`Actions for ${area.name}`}
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
                                  setEditingArea(area);
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
                                onClick={() => setDeleteTarget(area)}
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
      </CardContent>

      {dialogOpen && (
        <ServingAreaFormDialog
          area={editingArea}
          pending={saving}
          onClose={() => {
            if (!saving) {
              setDialogOpen(false);
              setEditingArea(null);
            }
          }}
          onSave={handleSave}
        />
      )}

      {can("serving_areas:create") && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          title="Serving Areas"
          onImported={load}
          parseExcelFile={parseExcelFile}
          validateImport={api.servingAreas.validateImport}
          confirmImport={api.servingAreas.confirmImport}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete serving area?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> serving
              area. Vehicles assigned to it will lose this zone.
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
    </Card>
  );
}
