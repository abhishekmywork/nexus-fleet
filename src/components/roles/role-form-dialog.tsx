"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Permission, Role } from "@/lib/auth-types";

export interface RoleFormValues {
  key?: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

interface RoleFormDialogProps {
  role: Role | null;
  permissions: Permission[];
  pending?: boolean;
  onClose: () => void;
  onSave: (values: RoleFormValues) => void;
}

function groupByModule(permissions: Permission[]) {
  const map = new Map<string, Permission[]>();
  for (const p of permissions) {
    const list = map.get(p.module) ?? [];
    list.push(p);
    map.set(p.module, list);
  }
  return Array.from(map.entries());
}

/**
 * Modal for creating or editing a role. The key is set on create only;
 * permissions are toggled from the full catalog, grouped by module.
 */
export function RoleFormDialog({
  role,
  permissions,
  pending,
  onClose,
  onSave,
}: RoleFormDialogProps) {
  const [form, setForm] = React.useState<RoleFormValues>(() =>
    role
      ? {
          name: role.name,
          description: role.description ?? "",
          permissionKeys: role.permissions.map((p) => p.key),
        }
      : {
          key: "",
          name: "",
          description: "",
          permissionKeys: [],
        }
  );

  const togglePermission = (key: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      permissionKeys: checked
        ? [...new Set([...prev.permissionKeys, key])]
        : prev.permissionKeys.filter((k) => k !== key),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role && !form.key) return;
    onSave(form);
  };

  const groups = groupByModule(permissions);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>
            {role
              ? "Rename the role and adjust its granted permissions."
              : "Define a new role and choose which permissions it grants."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {role && (
            <div className="grid gap-2">
              <Label>Role key</Label>
              <Input value={role.key} disabled aria-readonly />
            </div>
          )}

          {!role && (
            <div className="grid gap-2">
              <Label htmlFor="role-key">Role key</Label>
              <Input
                id="role-key"
                required
                value={form.key ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    key: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="SUPPORT_AGENT"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Uppercase key used to assign the role to users.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="role-name">Display name</Label>
            <Input
              id="role-name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Support Agent"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Handles customer support tickets"
            />
          </div>

          <div className="grid gap-2">
            <Label>Permissions</Label>
            {permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No permissions available.
              </p>
            ) : (
              <ScrollArea className="max-h-64 rounded-lg border">
                <div className="divide-y">
                  {groups.map(([module, perms]) => (
                    <div key={module} className="p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {module}
                      </p>
                      <div className="grid gap-1.5">
                        {perms.map((permission) => (
                          <label
                            key={permission.key}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <Checkbox
                              checked={form.permissionKeys.includes(permission.key)}
                              onCheckedChange={(checked) =>
                                togglePermission(permission.key, checked === true)
                              }
                              aria-label={`Toggle ${permission.name}`}
                            />
                            <span className="font-medium">{permission.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {permission.key}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          <DialogFooter className="pt-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : role ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
