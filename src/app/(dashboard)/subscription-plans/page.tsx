"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SubscriptionPlan } from "@/lib/auth-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Crown, Users, Car, Wifi } from "lucide-react";
import { toast } from "sonner";

const PLAN_FEATURES = [
  "live_map",
  "analytics",
  "reports",
  "telemetry",
  "geofencing",
  "events",
  "export",
  "api_access",
];

const FEATURE_LABELS: Record<string, string> = {
  live_map: "Live Map",
  analytics: "Analytics",
  reports: "Reports",
  telemetry: "Telemetry",
  geofencing: "Geofencing",
  events: "Events",
  export: "Data Export",
  api_access: "API Access",
};

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletePlan, setDeletePlan] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationDays: 30,
    maxUsers: "",
    maxVehicles: "",
    maxDevices: "",
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    features: {} as Record<string, boolean>,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPlans(await api.subscriptionPlans.list());
    } catch {
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      durationDays: 30,
      maxUsers: "",
      maxVehicles: "",
      maxDevices: "",
      isActive: true,
      isDefault: false,
      sortOrder: 0,
      features: {},
    });
    setDialogOpen(true);
  };

  const openEdit = (p: SubscriptionPlan) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      durationDays: p.durationDays,
      maxUsers: p.maxUsers?.toString() ?? "",
      maxVehicles: p.maxVehicles?.toString() ?? "",
      maxDevices: p.maxDevices?.toString() ?? "",
      isActive: p.isActive,
      isDefault: p.isDefault,
      sortOrder: p.sortOrder,
      features: p.features ?? {},
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Plan name is required"); return; }
    if (form.durationDays < 1) { toast.error("Duration must be at least 1 day"); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        durationDays: form.durationDays,
        maxUsers: form.maxUsers ? parseInt(form.maxUsers, 10) : undefined,
        maxVehicles: form.maxVehicles ? parseInt(form.maxVehicles, 10) : undefined,
        maxDevices: form.maxDevices ? parseInt(form.maxDevices, 10) : undefined,
        isActive: form.isActive,
        isDefault: form.isDefault,
        sortOrder: form.sortOrder,
        features: form.features,
      };

      if (editingId) {
        await api.subscriptionPlans.update(editingId, payload);
        toast.success("Plan updated");
      } else {
        await api.subscriptionPlans.create(payload);
        toast.success("Plan created");
      }
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save plan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    try {
      await api.subscriptionPlans.remove(deletePlan.id);
      toast.success("Plan deleted");
      setDeletePlan(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete plan");
    }
  };

  const toggleFeature = (key: string) => {
    setForm((f) => ({
      ...f,
      features: { ...f.features, [key]: !f.features[key] },
    }));
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Configure plans for tenants</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.isDefault ? "border-primary" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeletePlan(plan)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <CardDescription>{plan.description || "No description"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5" />
                  {plan.durationDays} days
                </span>
                {plan.maxUsers && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {plan.maxUsers} users
                  </span>
                )}
                {plan.maxVehicles && (
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" />
                    {plan.maxVehicles} vehicles
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(plan.features || {}).filter(([, v]) => v).map(([k]) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {FEATURE_LABELS[k] || k}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                {plan.isActive ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                {plan.isDefault && <Badge variant="outline">Default</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}

        {plans.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No plans configured. Create your first plan to get started.
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>Configure the subscription plan details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Starter, Professional, Enterprise"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this plan"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (days) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(e) => setForm((f) => ({ ...f, durationDays: parseInt(e.target.value, 10) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={form.maxUsers}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsers: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Vehicles</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={form.maxVehicles}
                  onChange={(e) => setForm((f) => ({ ...f, maxVehicles: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Devices</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={form.maxDevices}
                  onChange={(e) => setForm((f) => ({ ...f, maxDevices: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLAN_FEATURES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFeature(key)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      form.features[key]
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    {FEATURE_LABELS[key] || key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
                />
                <Label>Default Plan</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlan} onOpenChange={() => setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletePlan?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
