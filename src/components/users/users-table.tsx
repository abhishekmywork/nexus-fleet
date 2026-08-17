"use client";

import * as React from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Role, Tenant, User } from "@/lib/auth-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  UserFormDialog,
  type UserFormValues,
} from "@/components/users/user-form-dialog";
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

type SortKey = "name" | "email" | "roles" | "joined";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

const ROLE_VARIANTS: Record<string, "default" | "info" | "secondary"> = {
  SUPER_ADMIN: "default",
  ADMIN: "default",
  MANAGER: "info",
  EDITOR: "info",
  REPORTER: "secondary",
  VIEWER: "secondary",
};

function fullName(user: User) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function initialsOf(user: User) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface UsersDataOptions {
  includeRoles: boolean;
  includeTenants: boolean;
}

async function loadUsersData(options: UsersDataOptions) {
  const [userList, roleList] = await Promise.all([
    api.users.list(),
    options.includeRoles ? api.roles.list() : Promise.resolve([]),
  ]);
  const tenantList = options.includeTenants ? await api.tenants.list() : [];
  return { userList, roleList, tenantList };
}

/**
 * Clickable table header that toggles sorting for its column.
 */
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

/**
 * User management table backed by the live API. Search, sort, pagination,
 * multi-select bulk delete, and add/edit/delete flows gated by permissions.
 */
export function UsersTable() {
  const { user: me, can } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [dialogUser, setDialogUser] = React.useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadUsersData({
        includeRoles: can("roles:read"),
        includeTenants: me?.isSuperUser === true,
      });
      setUsers(data.userList);
      setRoles(data.roleList);
      setTenants(data.tenantList);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [can, me]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadUsersData({
          includeRoles: can("roles:read"),
          includeTenants: me?.isSuperUser === true,
        });
        if (cancelled) return;
        setUsers(data.userList);
        setRoles(data.roleList);
        setTenants(data.tenantList);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load users");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = can("users:create");
  const canUpdate = can("users:update");
  const canDelete = can("users:delete");
  const isSuper = me?.isSuperUser === true;

  // ---- Derived data: filter, sort, paginate ----
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...users]
      .filter(
        (u) =>
          !q ||
          fullName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let av: string;
        let bv: string;
        if (sortKey === "name") {
          av = fullName(a).toLowerCase();
          bv = fullName(b).toLowerCase();
        } else if (sortKey === "roles") {
          av = a.roles.map((r) => r.key).join(",");
          bv = b.roles.map((r) => r.key).join(",");
        } else if (sortKey === "joined") {
          return sortDir === "asc"
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else {
          av = a.email.toLowerCase();
          bv = b.email.toLowerCase();
        }
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    return sorted;
  }, [users, query, sortKey, sortDir]);

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

  // ---- CRUD actions ----
  const handleSave = async (values: UserFormValues) => {
    setSaving(true);
    try {
      if (dialogUser) {
        await api.users.update(dialogUser.id, {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          isActive: values.isActive,
        });
        if (values.roleKeys.length > 0) {
          await api.users.assignRoles(dialogUser.id, values.roleKeys);
        }
        toast.success("User updated");
      } else {
        if (!values.password) return;
        await api.users.create({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          tenantId: values.tenantId,
          roleKeys: values.roleKeys,
        });
        toast.success("User created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    try {
      await api.users.remove(user.id);
      toast.success("User deleted");
      setDeleteTarget(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const handleBulkDelete = async () => {
    setSaving(true);
    try {
      for (const id of selected) {
        await api.users.remove(id);
      }
      toast.success(`${selected.size} user(s) deleted`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete users");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users.length} total accounts · manage access and roles.
          </CardDescription>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setDialogUser(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Add New
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search name or email…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              className="h-9 rounded-lg pl-9"
              aria-label="Search users"
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
                  <SortHeader column="name" active={sortKey === "name"} onClick={toggleSort}>Name</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader column="email" active={sortKey === "email"} onClick={toggleSort}>Email</SortHeader>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <SortHeader column="roles" active={sortKey === "roles"} onClick={toggleSort}>Roles</SortHeader>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="hidden xl:table-cell">2FA</TableHead>
                {isSuper && <TableHead className="hidden xl:table-cell">Tenant</TableHead>}
                <TableHead className="hidden md:table-cell">
                  <SortHeader column="joined" active={sortKey === "joined"} onClick={toggleSort}>Joined</SortHeader>
                </TableHead>
                <TableHead className="w-[50px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={8 + (isSuper ? 1 : 0)}
                    className="h-24 text-center"
                  >
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8 + (isSuper ? 1 : 0)}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No users match your search.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((user) => (
                <TableRow
                  key={user.id}
                  className={cn(selected.has(user.id) && "bg-accent/40")}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(user.id)}
                      onCheckedChange={(checked) =>
                        toggleOne(user.id, checked === true)
                      }
                      aria-label={`Select ${fullName(user)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initialsOf(user)}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-medium">
                          {fullName(user)}
                          {user.isSuperUser && (
                            <ShieldCheck className="ml-1.5 inline size-3.5 text-primary" aria-hidden="true" />
                          )}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {user.roles.map((role) => (
                        <Badge
                          key={role.key}
                          variant={ROLE_VARIANTS[role.key] ?? "secondary"}
                          className="capitalize"
                        >
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge
                      variant={user.isActive ? "success" : "secondary"}
                      className="capitalize"
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {user.twoFactorEnabled ? (
                      <Badge variant="info" className="capitalize">
                        {user.twoFactorMethod ?? "enabled"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </TableCell>
                  {isSuper && (
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {tenants.find((t) => t.id === user.tenantId)?.name ??
                        user.tenantId?.slice(0, 8) ??
                        "—"}
                    </TableCell>
                  )}
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            aria-label={`Actions for ${fullName(user)}`}
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
                                setDialogUser(user);
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
                              onClick={() => setDeleteTarget(user)}
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
      </CardContent>

      {/* Add / Edit modal */}
      {dialogOpen && (
        <UserFormDialog
          user={dialogUser}
          roles={roles}
          tenants={tenants}
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
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
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
    </Card>
  );
}
