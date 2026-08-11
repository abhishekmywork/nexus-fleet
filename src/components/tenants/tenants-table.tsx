"use client";

import * as React from "react";
import {
  Building2,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Globe,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/auth-types";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EMPTY_FORM = { name: "", slug: "" };

/**
 * Tenant administration for super users. Each tenant is an isolated
 * data partition; users created against it only ever see its data.
 */
export function TenantsTable() {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = React.useState<Tenant | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setTenants(await api.tenants.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.tenants.list();
        if (cancelled) return;
        setTenants(list);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load tenants");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.tenants.create(form);
      toast.success("Tenant created");
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create tenant");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    try {
      await api.tenants.remove(tenant.id);
      toast.success("Tenant deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tenant");
    }
  };

  const handleTogglePublicLiveMap = async (tenant: Tenant) => {
    try {
      const updated = await api.tenants.togglePublicLiveMap(tenant.id, !tenant.publicLiveMap);
      setTenants((prev) => prev.map((t) => t.id === tenant.id ? { ...t, publicLiveMap: updated.publicLiveMap } : t));
      toast.success(`Public live map ${updated.publicLiveMap ? "enabled" : "disabled"} for ${tenant.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tenant");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>
            {tenants.length} organizations · isolated workspaces with their own
            users and roles.
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          New tenant
        </Button>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="hidden md:table-cell">Public Map</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
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
              {!loading &&
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Building2 className="size-4" aria-hidden="true" />
                        </span>
                        <span className="font-medium">{tenant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {tenant.slug}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tenant.publicLiveMap}
                          onCheckedChange={() => handleTogglePublicLiveMap(tenant)}
                          aria-label={`Toggle public map for ${tenant.name}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {tenant.publicLiveMap ? "On" : "Off"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            aria-label={`Actions for ${tenant.name}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(tenant)}
                          >
                            <Trash2 className="mr-2 size-4" aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(o) => !o && !saving && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New tenant</DialogTitle>
            <DialogDescription>
              Create a new isolated organization workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="tenant-name">Name</Label>
              <Input
                id="tenant-name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Acme Corp"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenant-slug">Slug</Label>
              <Input
                id="tenant-slug"
                required
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  }))
                }
                placeholder="acme"
              />
              <p className="text-xs text-muted-foreground">
                URL-safe identifier used across the platform.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.name || !form.slug}>
                {saving ? "Creating…" : "Create tenant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>{" "}
              workspace. This action cannot be undone.
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
