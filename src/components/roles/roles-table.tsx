"use client";

import * as React from "react";
import {
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Permission, Role } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  RoleFormDialog,
  type RoleFormValues,
} from "@/components/roles/role-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function loadRolesData() {
  const [roleList, permList] = await Promise.all([
    api.roles.list(),
    api.permissions.list(),
  ]);
  return { roleList, permList };
}

/**
 * RBAC control plane: lists roles, grants/revokes permissions, and
 * creates/edits/deletes custom roles. System roles are read-only.
 */
export function RolesTable() {
  const { can } = useAuth();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dialogRole, setDialogRole] = React.useState<Role | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Role | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { roleList, permList } = await loadRolesData();
      setRoles(roleList);
      setPermissions(permList);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { roleList, permList } = await loadRolesData();
        if (cancelled) return;
        setRoles(roleList);
        setPermissions(permList);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load roles");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canCreate = can("roles:create");
  const canUpdate = can("roles:update");
  const canDelete = can("roles:delete");

  const handleSave = async (values: RoleFormValues) => {
    setSaving(true);
    try {
      if (dialogRole) {
        await api.roles.update(dialogRole.id, {
          name: values.name,
          description: values.description || undefined,
        });
        await api.roles.assignPermissions(dialogRole.id, values.permissionKeys);
        toast.success("Role updated");
      } else {
        await api.roles.create({
          key: values.key ?? "",
          name: values.name,
          description: values.description || undefined,
          permissionKeys: values.permissionKeys,
        });
        toast.success("Role created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    try {
      await api.roles.remove(role.id);
      toast.success("Role deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            {roles.length} roles · combine permissions to grant access.
          </CardDescription>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setDialogRole(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Create role
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Key</TableHead>
                <TableHead className="hidden lg:table-cell">Permissions</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-[50px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
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
              {!loading &&
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{role.name}</p>
                        {role.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        {role.key}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {role.permissions.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            No permissions
                          </span>
                        )}
                        {role.permissions.slice(0, 6).map((permission) => (
                          <Badge key={permission.key} variant="secondary">
                            {permission.key}
                          </Badge>
                        ))}
                        {role.permissions.length > 6 && (
                          <Badge variant="outline">
                            +{role.permissions.length - 6}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={role.isSystem ? "default" : "info"}
                        className="capitalize"
                      >
                        {role.isSystem ? (
                          <>
                            <Lock className="mr-1 size-3" aria-hidden="true" />
                            System
                          </>
                        ) : (
                          "Custom"
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(role.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(canUpdate || (canDelete && !role.isSystem)) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              aria-label={`Actions for ${role.name}`}
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
                                  setDialogRole(role);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="mr-2 size-4" aria-hidden="true" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && !role.isSystem && (
                              <DropdownMenuItem
                                className="cursor-pointer text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(role)}
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
      </CardContent>

      {dialogOpen && (
        <RoleFormDialog
          role={dialogRole}
          permissions={permissions}
          pending={saving}
          onClose={() => {
            if (!saving) setDialogOpen(false);
          }}
          onSave={handleSave}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> role.
              Users assigned it will lose its permissions.
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
