"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Calendar,
  Users,
  Car,
  Wifi,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; color: string }> = {
  active: { variant: "default", icon: CheckCircle2, color: "text-green-500" },
  pending: { variant: "outline", icon: Clock, color: "text-yellow-500" },
  expired: { variant: "destructive", icon: AlertTriangle, color: "text-red-500" },
  suspended: { variant: "secondary", icon: XCircle, color: "text-orange-500" },
  cancelled: { variant: "destructive", icon: XCircle, color: "text-red-600" },
};

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

export default function MySubscriptionPage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof api.mySubscription>> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.mySubscription()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sub = data?.subscription;
  const plan = data?.plan;
  const usage = data?.usage;
  const statusConfig = sub ? STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active : null;
  const StatusIcon = statusConfig?.icon ?? AlertTriangle;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Subscription</h1>
        <p className="text-muted-foreground">View your current subscription status and plan details</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Crown className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {plan?.name ?? "No Active Plan"}
                </CardTitle>
                <CardDescription>
                  {sub?.status === "active"
                    ? "Your subscription is active"
                    : sub?.status === "suspended"
                      ? "Your subscription is suspended"
                      : sub?.status === "expired"
                        ? "Your subscription has expired"
                        : "No subscription assigned"}
                </CardDescription>
              </div>
            </div>
            {sub && statusConfig && (
              <Badge variant={statusConfig.variant} className="text-sm">
                <StatusIcon className={`mr-1 size-3.5 ${statusConfig.color}`} />
                {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!sub ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="mx-auto size-10 mb-3 opacity-50" />
              <p>No subscription has been assigned to your organization yet.</p>
              <p className="text-sm mt-1">Please contact your administrator to set up a subscription.</p>
            </div>
          ) : (
            <>
              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="size-4" />
                    Start Date
                  </div>
                  <p className="font-medium">
                    {new Date(sub.startDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="size-4" />
                    {sub.status === "expired" ? "Expired On" : "Valid Until"}
                  </div>
                  <p className="font-medium">
                    {new Date(sub.endDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Plan Limits */}
              {plan && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Plan Limits</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <Users className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Users</p>
                        <p className="font-medium">
                          {usage?.users.current ?? 0}
                          {plan.maxUsers ? ` / ${plan.maxUsers}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <Car className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Vehicles</p>
                        <p className="font-medium">
                          {plan.maxVehicles ? `Up to ${plan.maxVehicles}` : "Unlimited"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <Wifi className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Devices</p>
                        <p className="font-medium">
                          {plan.maxDevices ? `Up to ${plan.maxDevices}` : "Unlimited"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Features */}
              {plan?.features && Object.keys(plan.features).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Included Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(plan.features)
                      .filter(([, v]) => v)
                      .map(([key]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          <ShieldCheck className="mr-1 size-3" />
                          {FEATURE_LABELS[key] || key}
                        </Badge>
                      ))}
                    {Object.entries(plan.features).filter(([, v]) => v).length === 0 && (
                      <p className="text-sm text-muted-foreground">No features configured</p>
                    )}
                  </div>
                </div>
              )}

              {/* Cancel info */}
              {sub.status === "cancelled" && sub.cancelledAt && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">Subscription Cancelled</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cancelled on{" "}
                    {new Date(sub.cancelledAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  {sub.cancelledReason && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Reason: {sub.cancelledReason}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
