"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role, Tenant, User } from "@/lib/auth-types";

export interface UserFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  isActive: boolean;
  roleKeys: string[];
  tenantId?: string;
}

interface UserFormDialogProps {
  /** The user being edited, or null when creating a new user. */
  user: User | null;
  /** Available roles to assign (loaded from the RBAC catalog). */
  roles: Role[];
  /** Tenants for super users creating users in a specific tenant. */
  tenants: Tenant[];
  /** Whether the parent is awaiting the save request. */
  pending?: boolean;
  onClose: () => void;
  onSave: (values: UserFormValues) => void;
}

/**
 * Modal form for creating or editing a user against the API. Shows the
 * password field only when creating, and a tenant picker only to super
 * users. Roles are assigned as checkboxes.
 */
export function UserFormDialog({
  user,
  roles,
  tenants,
  pending,
  onClose,
  onSave,
}: UserFormDialogProps) {
  const [form, setForm] = React.useState<UserFormValues>(() =>
    user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
          roleKeys: user.roles.map((r) => r.key),
          tenantId: user.tenantId ?? undefined,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          isActive: true,
          roleKeys: [],
          tenantId: tenants[0]?.id,
        }
  );

  const toggleRole = (key: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      roleKeys: checked
        ? [...new Set([...prev.roleKeys, key])]
        : prev.roleKeys.filter((k) => k !== key),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !form.password) return;
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add new user"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update the profile and role assignments below."
              : "Create a new account and choose its initial roles."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-first-name">First name</Label>
              <Input
                id="user-first-name"
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                placeholder="Jane"
                autoFocus={!user}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-last-name">Last name</Label>
              <Input
                id="user-last-name"
                required
                value={form.lastName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="user-email">Email address</Label>
            <Input
              id="user-email"
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="jane@acme.io"
            />
          </div>

          {!user && (
            <div className="grid gap-2">
              <Label htmlFor="user-password">Temporary password</Label>
              <Input
                id="user-password"
                type="password"
                required
                minLength={8}
                value={form.password ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="At least 8 characters"
              />
            </div>
          )}

          {user && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="user-active">Active account</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive users cannot sign in.
                </p>
              </div>
              <Switch
                id="user-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          )}

          {tenants.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="user-tenant">Tenant</Label>
              <Select
                value={form.tenantId ?? undefined}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, tenantId: v }))
                }
              >
                <SelectTrigger id="user-tenant" className="w-full">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Roles</Label>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No roles available.
              </p>
            ) : (
              <ScrollArea className="max-h-44 rounded-lg border">
                <div className="grid gap-1.5 p-3">
                  {roles.map((role) => (
                    <label
                      key={role.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={form.roleKeys.includes(role.key)}
                        onCheckedChange={(checked) =>
                          toggleRole(role.key, checked === true)
                        }
                        aria-label={`Assign role ${role.name}`}
                      />
                      <span className="font-medium">{role.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {role.key}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : user
                  ? "Save changes"
                  : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
