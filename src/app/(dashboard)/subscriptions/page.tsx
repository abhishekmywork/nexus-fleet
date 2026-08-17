"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SubscriptionPlan, TenantSubscription, Tenant, TenantInvitation } from "@/lib/auth-types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Loader2, ShieldCheck, Mail, RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "outline",
  expired: "destructive",
  cancelled: "destructive",
  suspended: "secondary",
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<TenantSubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, p, t, inv] = await Promise.all([
        api.subscriptions.list(),
        api.subscriptionPlans.list(),
        api.tenants.list(),
        api.subscriptions.invitations.list(),
      ]);
      setSubs(s);
      setPlans(p);
      setTenants(t);
      setInvitations(inv);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleCreate = async () => {
    if (!selectedTenant || !selectedPlan) {
      toast.error("Select tenant and plan");
      return;
    }
    setSaving(true);
    try {
      await api.subscriptions.create({ tenantId: selectedTenant, planId: selectedPlan });
      toast.success("Subscription created");
      setCreateOpen(false);
      setSelectedTenant("");
      setSelectedPlan("");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedTenant || !inviteEmail.trim()) {
      toast.error("Select tenant and enter email");
      return;
    }
    setSaving(true);
    try {
      const result = await api.subscriptions.invitations.create({
        tenantId: selectedTenant,
        email: inviteEmail.trim(),
      });
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      setSelectedTenant("");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send invitation");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (subId: string, action: "suspend" | "reactivate" | "cancel") => {
    try {
      if (action === "suspend") await api.subscriptions.suspend(subId);
      else if (action === "reactivate") await api.subscriptions.reactivate(subId);
      else await api.subscriptions.cancel(subId);
      toast.success(`Subscription ${action}d`);
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Code copied");
  };

  const resendInvite = async (tenantId: string) => {
    try {
      await api.subscriptions.invitations.resend(tenantId);
      toast.success("Invitation resent");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to resend");
    }
  };

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? id.slice(0, 8);

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
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage tenant subscriptions and invitations</p>
        </div>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Subscription
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No subscriptions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    subs.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{tenantName(sub.tenantId)}</TableCell>
                        <TableCell>{sub.plan?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[sub.status] || "secondary"}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(sub.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(sub.endDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {sub.status === "active" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => handleStatusChange(sub.id, "suspend")}>
                                  Suspend
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleStatusChange(sub.id, "cancel")}>
                                  Cancel
                                </Button>
                              </>
                            )}
                            {(sub.status === "suspended" || sub.status === "expired") && (
                              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(sub.id, "reactivate")}>
                                Reactivate
                              </Button>
                            )}
                            {sub.status === "cancelled" && (
                              <Badge variant="secondary" className="text-xs">Cancelled</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setInviteOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Send Invitation
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No invitations
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{tenantName(inv.tenantId)}</TableCell>
                        <TableCell>{inv.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-0.5 rounded">
                              {revealedCodes[inv.id] ? inv.code : "••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setRevealedCodes((prev) => ({
                                  ...prev,
                                  [inv.id]: prev[inv.id] ? "" : inv.code,
                                }));
                              }}
                            >
                              {revealedCodes[inv.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(inv.code, inv.id)}
                            >
                              {copiedId === inv.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={inv.usedAt ? "default" : "outline"}>
                            {inv.usedAt ? "Used" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!inv.usedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendInvite(inv.tenantId)}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Resend
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Subscription Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Subscription</DialogTitle>
            <DialogDescription>Assign a plan to a tenant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.durationDays}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invitation</DialogTitle>
            <DialogDescription>Send an activation code to a tenant admin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
