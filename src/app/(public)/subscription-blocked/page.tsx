"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  Ban,
  XCircle,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Calendar,
  CreditCard,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string; title: string; description: string }> = {
  suspended: {
    icon: ShieldAlert,
    color: "text-orange-500 bg-orange-500/10",
    label: "Suspended",
    title: "Account Suspended",
    description: "Your organization's subscription has been suspended. Please contact the system administrator to resolve this issue and restore access.",
  },
  expired: {
    icon: Clock,
    color: "text-red-500 bg-red-500/10",
    label: "Expired",
    title: "Subscription Expired",
    description: "Your organization's subscription has expired. Please renew your subscription to continue using the platform.",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-600 bg-red-600/10",
    label: "Cancelled",
    title: "Subscription Cancelled",
    description: "Your organization's subscription has been cancelled. Please contact the system administrator to set up a new subscription.",
  },
  none: {
    icon: Ban,
    color: "text-gray-500 bg-gray-500/10",
    label: "No Subscription",
    title: "No Active Subscription",
    description: "Your organization does not have an active subscription. Please contact the system administrator to get started.",
  },
  not_found: {
    icon: AlertTriangle,
    color: "text-red-500 bg-red-500/10",
    label: "Not Found",
    title: "Organization Not Found",
    description: "The organization you're trying to access could not be found.",
  },
};

export default function SubscriptionBlockedPage() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant") ?? "";

  const [data, setData] = React.useState<Awaited<ReturnType<typeof api.subscriptionStatus>> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!tenantSlug) {
      setLoading(false);
      return;
    }
    api.subscriptionStatus(tenantSlug).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [tenantSlug]);

  const config = data ? STATUS_CONFIG[data.status] ?? STATUS_CONFIG.none : STATUS_CONFIG.not_found;
  const StatusIcon = config.icon;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            MST<span className="text-primary">-VTS</span>
          </span>
        </div>

        {/* Main Status Card */}
        <Card className="border-2">
          <CardHeader className="items-center text-center">
            <div className={`flex size-14 items-center justify-center rounded-2xl ${config.color}`}>
              <StatusIcon className="size-7" aria-hidden="true" />
            </div>
            <CardTitle className="pt-3 text-xl">{config.title}</CardTitle>
            <CardDescription className="max-w-sm text-sm leading-relaxed">
              {config.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Details */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={data?.status === "active" ? "default" : "destructive"}>
                  {config.label}
                </Badge>
              </div>
              {data?.tenant && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Organization</span>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    {data.tenant.name}
                  </span>
                </div>
              )}
              {data?.subscription?.plan && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <CreditCard className="size-3.5" />
                    {data.subscription.plan.name}
                  </span>
                </div>
              )}
              {data?.subscription?.endDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {data.status === "expired" ? "Expired on" : data.status === "active" ? "Valid until" : "End date"}
                  </span>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    {new Date(data.subscription.endDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Contact Information */}
            {data?.contact && (data.contact.email || data.contact.phone) && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="text-sm font-medium mb-3">Contact Administrator</h3>
                <div className="space-y-2">
                  {data.contact.name && (
                    <p className="text-sm text-muted-foreground">{data.contact.name}</p>
                  )}
                  {data.contact.email && (
                    <a
                      href={`mailto:${data.contact.email}?subject=Subscription%20Issue%20-%20${data.tenant?.name ?? ""}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Mail className="size-3.5" />
                      {data.contact.email}
                    </a>
                  )}
                  {data.contact.phone && (
                    <a
                      href={`tel:${data.contact.phone}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Phone className="size-3.5" />
                      {data.contact.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Again
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
