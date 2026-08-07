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
      // Refresh
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Settings"
        description="System-wide configuration. Only super admins can modify these."
      />

      <Tabs defaultValue="event_defaults" className="space-y-6">
        <TabsList>
          <TabsTrigger value="event_defaults">Event Defaults</TabsTrigger>
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
