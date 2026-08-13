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
import { ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";
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

/**
 * Maps page permissions to the action permissions they require.
 * When a page is toggled ON, these action permissions are auto-enabled.
 */
const PAGE_ACTION_MAP: Record<string, string[]> = {
  "page:live_map": ["telemetry:read", "geofences:read"],
  "page:dashboard": [],
  "page:analytics": [],
  "page:reports": ["telemetry:read", "events:read", "geofences:read"],
  "page:vehicles": ["vehicles:read"],
  "page:serving_areas": ["serving_areas:read"],
  "page:drivers": ["drivers:read"],
  "page:gps_devices": ["gps_devices:read"],
  "page:telemetry": ["telemetry:read"],
  "page:events": ["events:read"],
  "page:geofences": ["geofences:read"],
  "page:users": ["users:read"],
  "page:products": [],
  "page:roles": ["roles:read", "permissions:read"],
  "page:tenants": ["tenants:read"],
  "page:settings": ["settings:global:read", "settings:tenant:read"],
};

/** Human-readable labels for page sections */
const PAGE_LABELS: Record<string, string> = {
  "page:live_map": "Live Map",
  "page:dashboard": "Dashboard",
  "page:analytics": "Analytics",
  "page:reports": "Reports",
  "page:vehicles": "Vehicles",
  "page:serving_areas": "Serving Areas",
  "page:drivers": "Drivers",
  "page:gps_devices": "GPS Devices",
  "page:telemetry": "Telemetry",
  "page:events": "Events",
  "page:geofences": "Geofences",
  "page:users": "Users",
  "page:products": "Products",
  "page:roles": "Roles & Permissions",
  "page:tenants": "Tenants",
  "page:settings": "Settings",
};

/** Order pages to match sidebar order */
const PAGE_ORDER = [
  "page:live_map",
  "page:dashboard",
  "page:analytics",
  "page:reports",
  "page:vehicles",
  "page:serving_areas",
  "page:drivers",
  "page:gps_devices",
  "page:telemetry",
  "page:events",
  "page:geofences",
  "page:users",
  "page:products",
  "page:roles",
  "page:tenants",
  "page:settings",
];

/**
 * Modal for creating or editing a role.
 *
 * Permission UI is structured as:
 *   [Page Section]         — toggle to show/hide a page in the sidebar
 *     └─ Action permissions — checkboxes for API operations under that page
 *
 * Toggling a page ON auto-enables its required action permissions.
 * Toggling a page OFF removes it and its action permissions.
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

  const [expandedPages, setExpandedPages] = React.useState<Set<string>>(
    new Set()
  );

  const togglePermission = (key: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      permissionKeys: checked
        ? [...new Set([...prev.permissionKeys, key])]
        : prev.permissionKeys.filter((k) => k !== key),
    }));

  const togglePage = (pageKey: string, checked: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.permissionKeys);
      const requiredActions = PAGE_ACTION_MAP[pageKey] ?? [];

      if (checked) {
        next.add(pageKey);
        for (const action of requiredActions) next.add(action);
      } else {
        next.delete(pageKey);
        // Only remove action permissions if no other page needs them
        for (const action of requiredActions) {
          const stillNeeded = Object.entries(PAGE_ACTION_MAP).some(
            ([pk, actions]) =>
              pk !== pageKey &&
              next.has(pk) &&
              actions.includes(action)
          );
          if (!stillNeeded) next.delete(action);
        }
      }

      return { ...prev, permissionKeys: Array.from(next) };
    });
  };

  const toggleAllPages = (checked: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.permissionKeys);
      for (const pageKey of PAGE_ORDER) {
        if (checked) {
          next.add(pageKey);
          for (const action of PAGE_ACTION_MAP[pageKey] ?? []) next.add(action);
        } else {
          next.delete(pageKey);
          // Only remove actions that aren't needed by other pages
          for (const action of PAGE_ACTION_MAP[pageKey] ?? []) {
            const stillNeeded = Object.entries(PAGE_ACTION_MAP).some(
              ([pk, actions]) => pk !== pageKey && next.has(pk) && actions.includes(action)
            );
            if (!stillNeeded) next.delete(action);
          }
        }
      }
      return { ...prev, permissionKeys: Array.from(next) };
    });
  };

  const toggleExpanded = (pageKey: string) =>
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageKey)) next.delete(pageKey);
      else next.add(pageKey);
      return next;
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role && !form.key) return;
    onSave(form);
  };

  // Separate page and action permissions
  const pagePermissions = permissions
    .filter((p) => p.type === "page")
    .sort(
      (a, b) =>
        PAGE_ORDER.indexOf(a.key) - PAGE_ORDER.indexOf(b.key)
    );

  const actionPermissions = permissions.filter((p) => p.type === "action");

  // Group action permissions by module
  const actionByModule = new Map<string, Permission[]>();
  for (const p of actionPermissions) {
    const mod = p.module ?? "other";
    const list = actionByModule.get(mod) ?? [];
    list.push(p);
    actionByModule.set(mod, list);
  }

  const allPagesSelected = pagePermissions.every((p) =>
    form.permissionKeys.includes(p.key)
  );
  const somePagesSelected = pagePermissions.some((p) =>
    form.permissionKeys.includes(p.key)
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>
            {role
              ? "Rename the role and adjust its granted permissions."
              : "Define a new role and choose which pages and actions it grants."}
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

          <Separator />

          {/* Page & Action Permissions */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Pages & Permissions</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleAllPages(!allPagesSelected)}
              >
                {allPagesSelected ? (
                  <CheckSquare className="mr-1 size-3.5" />
                ) : (
                  <Square className="mr-1 size-3.5" />
                )}
                {allPagesSelected ? "Deselect all" : "Select all"}
              </Button>
            </div>

            {permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No permissions available.
              </p>
            ) : (
              <ScrollArea className="max-h-80 rounded-lg border">
                <div className="divide-y">
                  {pagePermissions.map((pagePerm) => {
                    const isPageOn = form.permissionKeys.includes(pagePerm.key);
                    const isExpanded = expandedPages.has(pagePerm.key);
                    const requiredActions = PAGE_ACTION_MAP[pagePerm.key] ?? [];
                    const moduleActions =
                      actionByModule.get(pagePerm.module ?? "") ?? [];

                    // Actions to show: required actions for this page + any extra from same module
                    const relevantActions = [
                      ...new Set([...requiredActions, ...moduleActions.map((a) => a.key)]),
                    ]
                      .map((key) => actionPermissions.find((a) => a.key === key))
                      .filter(Boolean) as Permission[];

                    return (
                      <div key={pagePerm.key} className="p-3">
                        {/* Page toggle row */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isPageOn}
                            onCheckedChange={(checked) =>
                              togglePage(pagePerm.key, checked === true)
                            }
                            aria-label={`Toggle ${pagePerm.name}`}
                          />
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-1.5 text-sm font-medium hover:text-foreground"
                            onClick={() => toggleExpanded(pagePerm.key)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            )}
                            {pagePerm.name}
                          </button>
                          {isPageOn && requiredActions.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {requiredActions.filter((a) =>
                                form.permissionKeys.includes(a)
                              ).length}
                              /
                              {requiredActions.length} actions
                            </span>
                          )}
                        </div>

                        {/* Expanded action permissions */}
                        {isExpanded && isPageOn && relevantActions.length > 0 && (
                          <div className="ml-7 mt-2 grid gap-1 border-l-2 border-muted pl-3">
                            {relevantActions.map((action) => (
                              <label
                                key={action.key}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                              >
                                <Checkbox
                                  checked={form.permissionKeys.includes(action.key)}
                                  onCheckedChange={(checked) =>
                                    togglePermission(action.key, checked === true)
                                  }
                                  aria-label={`Toggle ${action.name}`}
                                />
                                <span className="flex-1">{action.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {action.key}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
              {pending ? "Saving..." : role ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
