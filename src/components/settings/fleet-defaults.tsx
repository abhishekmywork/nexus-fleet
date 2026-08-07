"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { TenantSetting } from "@/lib/auth-types";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

export function FleetDefaults() {
  const [settings, setSettings] = React.useState<TenantSetting | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [speedLimit, setSpeedLimit] = React.useState(120);
  const [idleMinutes, setIdleMinutes] = React.useState(10);
  const [stoppageMinutes, setStoppageMinutes] = React.useState(5);
  const [offlineMinutes, setOfflineMinutes] = React.useState(30);
  const [geofenceBuffer, setGeofenceBuffer] = React.useState(50);
  const [cooldownMinutes, setCooldownMinutes] = React.useState(5);
  const [timezone, setTimezone] = React.useState("UTC");

  React.useEffect(() => {
    async function load() {
      try {
        const data = await api.tenantSettings.get();
        setSettings(data);
        setSpeedLimit(data.defaultSpeedLimit);
        setIdleMinutes(data.idleThresholdMinutes);
        setStoppageMinutes(data.stoppageThresholdMinutes);
        setOfflineMinutes(data.offlineThresholdMinutes);
        setGeofenceBuffer(data.geofenceBufferMeters);
        setCooldownMinutes(data.eventCooldownMinutes);
        setTimezone(data.timezone);
      } catch {
        toast.error("Failed to load tenant settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tenantSettings.update({
        defaultSpeedLimit: speedLimit,
        idleThresholdMinutes: idleMinutes,
        stoppageThresholdMinutes: stoppageMinutes,
        offlineThresholdMinutes: offlineMinutes,
        geofenceBufferMeters: geofenceBuffer,
        eventCooldownMinutes: cooldownMinutes,
        timezone,
      });
      toast.success("Fleet defaults saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Defaults"
        description="Tenant-specific fleet configuration. These override global defaults."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Event Thresholds</CardTitle>
          <CardDescription>
            Override the global event detection thresholds for this tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="speed-limit">Default Speed Limit (km/h)</Label>
              <Input
                id="speed-limit"
                type="number"
                value={speedLimit}
                onChange={(e) => setSpeedLimit(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="idle-minutes">Idle Threshold (minutes)</Label>
              <Input
                id="idle-minutes"
                type="number"
                value={idleMinutes}
                onChange={(e) => setIdleMinutes(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stoppage-minutes">Stoppage Threshold (minutes)</Label>
              <Input
                id="stoppage-minutes"
                type="number"
                value={stoppageMinutes}
                onChange={(e) => setStoppageMinutes(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offline-minutes">Offline Threshold (minutes)</Label>
              <Input
                id="offline-minutes"
                type="number"
                value={offlineMinutes}
                onChange={(e) => setOfflineMinutes(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="geofence-buffer">Geofence Buffer (meters)</Label>
              <Input
                id="geofence-buffer"
                type="number"
                value={geofenceBuffer}
                onChange={(e) => setGeofenceBuffer(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cooldown-minutes">Event Cooldown (minutes)</Label>
              <Input
                id="cooldown-minutes"
                type="number"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Regional</CardTitle>
          <CardDescription>Timezone and regional preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-sm">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          <Save className="mr-2 size-4" />
          Save changes
        </Button>
      </div>
    </div>
  );
}
