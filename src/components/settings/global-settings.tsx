"use client";

import * as React from "react";
import { Loader2, Save, Info } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { GlobalSetting } from "@/lib/auth-types";

export function GlobalSettings() {
  const [settings, setSettings] = React.useState<GlobalSetting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [edits, setEdits] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    async function load() {
      try {
        const data = await api.globalSettings.list();
        setSettings(data);
        const initial: Record<string, string> = {};
        for (const s of data) initial[s.key] = s.value;
        setEdits(initial);
      } catch {
        toast.error("Failed to load global settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(edits).map(([key, value]) => {
        const existing = settings.find((s) => s.key === key);
        return { key, value, category: existing?.category, description: existing?.description };
      });
      await api.globalSettings.bulkSet(entries);
      toast.success("Global settings saved");
      const data = await api.globalSettings.list();
      setSettings(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const eventDefaults = settings.filter((s) => s.category === "event_defaults");
  const systemSettings = settings.filter((s) => s.category === "system");
  const gpsSettings = settings.filter((s) => s.category === "gps");

  const gpsCoordinateMode = edits["gps.coordinateMode"] ?? settings.find((s) => s.key === "gps.coordinateMode")?.value ?? "corrected";
  const isCorrected = gpsCoordinateMode === "corrected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Settings"
        description="System-wide configuration. Only super admins can modify these."
      />

      <Tabs defaultValue="event_defaults" className="space-y-6">
        <TabsList>
          <TabsTrigger value="event_defaults">Event Defaults</TabsTrigger>
          <TabsTrigger value="gps">GPS</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="event_defaults" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Event Detection Thresholds</CardTitle>
              <CardDescription>
                Default thresholds for event detection. Tenants can override these values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {eventDefaults.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <Label htmlFor={s.key}>{s.description || s.key}</Label>
                    <Input
                      id={s.key}
                      type="number"
                      value={edits[s.key] ?? s.value}
                      onChange={(e) => updateField(s.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gps" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>GPS Coordinate Mode</CardTitle>
              <CardDescription>
                Choose whether to display raw GPS coordinates or cleaned coordinates that are filtered, smoothed, and snapped to roads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Use Corrected Coordinates</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, the system uses post-processed coordinates (filtered, Kalman-smoothed, OSRM map-matched, and simplified).
                    When disabled, raw GPS coordinates are used.
                  </p>
                </div>
                <Switch
                  checked={isCorrected}
                  onCheckedChange={(checked) =>
                    updateField("gps.coordinateMode", checked ? "corrected" : "raw")
                  }
                />
              </div>

              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">What does this affect?</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Live map vehicle positions and trail lines</li>
                      <li>All reports (vehicle trip, daily summary, speed violations, driver activity, travel distance)</li>
                      <li>Distance calculations and speed analysis</li>
                    </ul>
                    <p className="pt-1">
                      <strong>Note:</strong> Raw coordinates come directly from GPS devices and may deviate from actual roads due to signal noise. Corrected coordinates are processed through heuristic filtering, Kalman smoothing, and map-matching.
                    </p>
                  </div>
                </div>
              </div>

              {gpsSettings.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {gpsSettings.map((s) => (
                    <div key={s.key} className="grid gap-2">
                      <Label htmlFor={s.key}>{s.description || s.key}</Label>
                      <Input
                        id={s.key}
                        value={edits[s.key] ?? s.value}
                        onChange={(e) => updateField(s.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Global system settings including data retention policies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {systemSettings.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <Label htmlFor={s.key}>{s.description || s.key}</Label>
                    <Input
                      id={s.key}
                      type="number"
                      value={edits[s.key] ?? s.value}
                      onChange={(e) => updateField(s.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
