"use client";

import * as React from "react";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  MapPin,
  FileUp,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Geofence } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { GeofenceImportDialog } from "./geofence-import-dialog";

interface GeofenceFormValues {
  name: string;
  type: "circle" | "polygon";
  centerLat: string;
  centerLon: string;
  radiusMeters: string;
  polygonPoints: string;
  enabled: boolean;
}

const defaultForm: GeofenceFormValues = {
  name: "",
  type: "circle",
  centerLat: "",
  centerLon: "",
  radiusMeters: "500",
  polygonPoints: "",
  enabled: true,
};

export function GeofencesTable() {
  const { can } = useAuth();
  const [geofences, setGeofences] = React.useState<Geofence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Geofence | null>(null);
  const [editing, setEditing] = React.useState<Geofence | null>(null);
  const [form, setForm] = React.useState<GeofenceFormValues>(defaultForm);
  const [importOpen, setImportOpen] = React.useState(false);
  const [toggling, setToggling] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = React.useState("");
  const [editingNameSaving, setEditingNameSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.geofences.list();
      setGeofences(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load geofences");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (gf: Geofence) => {
    setEditing(gf);
    const coords = gf.coordinates;
    if (gf.type === "circle" && coords.center) {
      setForm({
        name: gf.name,
        type: "circle",
        centerLat: String(coords.center.lat ?? ""),
        centerLon: String(coords.center.lon ?? ""),
        radiusMeters: String(coords.radiusMeters ?? 500),
        polygonPoints: "",
        enabled: gf.enabled,
      });
    } else if (gf.type === "polygon" && Array.isArray(coords.points)) {
      setForm({
        name: gf.name,
        type: "polygon",
        centerLat: "",
        centerLon: "",
        radiusMeters: "",
        polygonPoints: coords.points
          .map((p: { lat: number; lon: number }) => `${p.lat},${p.lon}`)
          .join("\n"),
        enabled: gf.enabled,
      });
    }
    setDialogOpen(true);
  };

  const buildCoordinates = (f: GeofenceFormValues): Record<string, any> => {
    if (f.type === "circle") {
      return {
        center: {
          lat: parseFloat(f.centerLat) || 0,
          lon: parseFloat(f.centerLon) || 0,
        },
        radiusMeters: parseInt(f.radiusMeters) || 500,
      };
    }
    const points = f.polygonPoints
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [lat, lon] = line.split(",").map(Number);
        return { lat: lat || 0, lon: lon || 0 };
      });
    return { points };
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const coordinates = buildCoordinates(form);
      if (editing) {
        await api.geofences.update(editing.id, {
          name: form.name,
          type: form.type,
          coordinates,
          enabled: form.enabled,
        });
        toast.success("Geofence updated");
      } else {
        await api.geofences.create({
          name: form.name,
          type: form.type,
          coordinates,
          enabled: form.enabled,
        });
        toast.success("Geofence created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.geofences.remove(deleteTarget.id);
      toast.success("Geofence deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleToggle = async (gf: Geofence, enabled: boolean) => {
    setToggling(gf.id);
    try {
      await api.geofences.update(gf.id, {
        name: gf.name,
        type: gf.type,
        coordinates: gf.coordinates,
        enabled,
      });
      setGeofences((prev) =>
        prev.map((g) => (g.id === gf.id ? { ...g, enabled } : g))
      );
      toast.success(`Geofence ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setToggling(null);
    }
  };

  const handleSaveName = async (gf: Geofence) => {
    const trimmed = editingNameValue.trim();
    if (!trimmed || trimmed === gf.name) {
      setEditingName(null);
      return;
    }
    setEditingNameSaving(true);
    try {
      await api.geofences.update(gf.id, {
        name: trimmed,
        type: gf.type,
        coordinates: gf.coordinates,
        enabled: gf.enabled,
      });
      setGeofences((prev) =>
        prev.map((g) => (g.id === gf.id ? { ...g, name: trimmed } : g))
      );
      toast.success("Name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setEditingNameSaving(false);
      setEditingName(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Geofences</CardTitle>
          <CardDescription>
            {geofences.length} geofences · define areas for entry/exit alerts
          </CardDescription>
        </div>
        {can("geofences:create") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="mr-2 size-4" />
              Import
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Add Geofence
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                {(can("geofences:update") || can("geofences:delete")) && (
                  <TableHead className="w-[50px] text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && geofences.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                    No geofences defined. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                geofences.map((gf) => (
                  <TableRow key={gf.id}>
                    <TableCell className="font-medium">
                      {editingName === gf.id ? (
                        <input
                          className="h-7 w-full rounded border bg-transparent px-1.5 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => handleSaveName(gf)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveName(gf);
                            if (e.key === "Escape") setEditingName(null);
                          }}
                          autoFocus
                          disabled={editingNameSaving}
                        />
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-accent"
                          onClick={() => {
                            setEditingName(gf.id);
                            setEditingNameValue(gf.name);
                          }}
                        >
                          <MapPin className="size-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{gf.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {gf.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {gf.type === "circle" ? (
                        <>
                          {gf.coordinates.center?.lat?.toFixed(4)},{" "}
                          {gf.coordinates.center?.lon?.toFixed(4)} ·{" "}
                          {gf.coordinates.radiusMeters}m radius
                        </>
                      ) : (
                        <>
                          {gf.coordinates.points?.length ?? 0} points
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {can("geofences:update") ? (
                        <Switch
                          checked={gf.enabled}
                          onCheckedChange={(checked) => handleToggle(gf, checked)}
                          disabled={toggling === gf.id}
                        />
                      ) : (
                        <Badge variant={gf.enabled ? "success" : "secondary"}>
                          {gf.enabled ? "Active" : "Disabled"}
                        </Badge>
                      )}
                    </TableCell>
                    {(can("geofences:update") || can("geofences:delete")) && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {can("geofences:update") && (
                              <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(gf)}>
                                <Pencil className="mr-2 size-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {can("geofences:delete") && (
                              <DropdownMenuItem
                                className="cursor-pointer text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(gf)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit geofence" : "Add geofence"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the geofence boundary and settings."
                : "Define a new geofence area for entry/exit alerts."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Office Area"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, type: v as "circle" | "polygon" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.enabled ? "active" : "disabled"}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, enabled: v === "active" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.type === "circle" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Center Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.centerLat}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, centerLat: e.target.value }))
                      }
                      placeholder="23.1584"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Center Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.centerLon}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, centerLon: e.target.value }))
                      }
                      placeholder="88.5542"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Radius (meters)</Label>
                  <Input
                    type="number"
                    value={form.radiusMeters}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, radiusMeters: e.target.value }))
                    }
                    placeholder="500"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label>Points (one per line: lat,lon)</Label>
                <textarea
                  className="min-h-[120px] rounded-lg border bg-transparent px-3 py-2 text-sm"
                  value={form.polygonPoints}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, polygonPoints: e.target.value }))
                  }
                  placeholder={"23.15,88.55\n23.16,88.56\n23.14,88.56"}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete geofence?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> and stop
              generating entry/exit events for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GeofenceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />
    </Card>
  );
}
