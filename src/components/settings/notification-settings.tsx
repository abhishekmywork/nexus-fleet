"use client";

import * as React from "react";
import { Loader2, Plus, X, Send, Mail, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import type { NotificationSettings, NotificationLog } from "@/lib/auth-types";
import { EVENT_TYPE_LABELS } from "@/components/events/events-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type EventOverride = { enabled: boolean; recipients: string[] };

function EmailChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = React.useState("");

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) {
      onChange([...value, v]);
    }
    setInput("");
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-[120px]"
      />
    </div>
  );
}

function EventOverridesTable({
  overrides,
  onChange,
  globalRecipients,
  channelLabel,
}: {
  overrides: Record<string, EventOverride>;
  onChange: (v: Record<string, EventOverride>) => void;
  globalRecipients: string[];
  channelLabel: string;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const eventTypes = Object.keys(EVENT_TYPE_LABELS) as Array<string>;

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Event Type</TableHead>
            <TableHead className="w-[80px] text-center">Enabled</TableHead>
            <TableHead>Override Recipients</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventTypes.map((et) => {
            const ov = overrides[et] ?? { enabled: true, recipients: [] };
            const hasOverride = ov.recipients.length > 0;
            const label = (EVENT_TYPE_LABELS as Record<string, string>)[et] ?? et;
            return (
              <React.Fragment key={et}>
                <TableRow>
                  <TableCell className="font-medium text-sm">{label}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={ov.enabled}
                      onCheckedChange={(checked) =>
                        onChange({ ...overrides, [et]: { ...ov, enabled: checked } })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setExpanded(expanded === et ? null : (et as string))}
                    >
                      {hasOverride
                        ? `${ov.recipients.length} override(s)`
                        : `Use global (${globalRecipients.length})`}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded === et && (
                  <TableRow>
                    <TableCell colSpan={3} className="bg-muted/30 p-4">
                      <Label className="text-xs mb-2 block">
                        {channelLabel} recipients for {label} (leave empty to use global)
                      </Label>
                      <EmailChipInput
                        value={ov.recipients}
                        onChange={(recipients) =>
                          onChange({ ...overrides, [et]: { ...ov, recipients } })
                        }
                        placeholder={
                          channelLabel === "Email" ? "alert@company.com" : "+919876543210"
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function NotificationSettings() {
  const { user } = useAuth();
  const isSuperUser = user?.isSuperUser;

  // Global SMTP/SMS config
  const [smtpConfig, setSmtpConfig] = React.useState({
    host: "", port: 587, secure: false, username: "", password: "", fromEmail: "", fromName: "",
  });
  const [smsConfig, setSmsConfig] = React.useState({ apiKey: "", senderId: "", type: "transactional" });
  const [smtpLoading, setSmtpLoading] = React.useState(true);
  const [smsConfigLoading, setSmsConfigLoading] = React.useState(true);
  const [smtpSaving, setSmtpSaving] = React.useState(false);
  const [smsConfigSaving, setSmsConfigSaving] = React.useState(false);

  // Per-tenant notification settings
  const [settings, setSettings] = React.useState<Partial<NotificationSettings> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testEmail, setTestEmail] = React.useState("");
  const [testPhone, setTestPhone] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [logs, setLogs] = React.useState<NotificationLog[]>([]);
  const [logsMeta, setLogsMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = React.useState(false);

  // Load global SMTP config
  React.useEffect(() => {
    if (!isSuperUser) { setSmtpLoading(false); return; }
    api.notifications.getSmtpConfig()
      .then(setSmtpConfig)
      .catch(() => {})
      .finally(() => setSmtpLoading(false));
  }, [isSuperUser]);

  // Load global SMS config
  React.useEffect(() => {
    if (!isSuperUser) { setSmsConfigLoading(false); return; }
    api.notifications.getSmsConfig()
      .then(setSmsConfig)
      .catch(() => {})
      .finally(() => setSmsConfigLoading(false));
  }, [isSuperUser]);

  // Load per-tenant settings
  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    const defaults: Partial<NotificationSettings> = {
      emailEnabled: false,
      emailGlobalRecipients: [],
      emailEventOverrides: {},
      smsEnabled: false,
      smsGlobalRecipients: [],
      smsEventOverrides: {},
    };
    try {
      const data = await api.notifications.getSettings();
      setSettings(data ?? defaults);
    } catch (err) {
      setSettings(defaults);
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = React.useCallback(async (page = 1) => {
    setLogsLoading(true);
    try {
      const res = await api.notifications.getLogs(page);
      setLogs(res.data);
      setLogsMeta(res.meta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  React.useEffect(() => { loadSettings(); }, [loadSettings]);

  const update = (patch: Partial<NotificationSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Save SMTP config
  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      const payload = { ...smtpConfig };
      if (payload.password.startsWith('\u2022')) {
        payload.password = '';
      }
      await api.notifications.saveSmtpConfig(payload);
      toast.success("SMTP configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save SMTP config");
    } finally {
      setSmtpSaving(false);
    }
  };

  // Save SMS config
  const handleSaveSmsConfig = async () => {
    setSmsConfigSaving(true);
    try {
      const payload = { ...smsConfig };
      if (payload.apiKey.startsWith('\u2022')) {
        payload.apiKey = '';
      }
      await api.notifications.saveSmsConfig(payload);
      toast.success("SMS configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save SMS config");
    } finally {
      setSmsConfigSaving(false);
    }
  };

  // Save per-tenant settings
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await api.notifications.saveSettings(settings);
      setSettings(saved);
      toast.success("Notification preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTesting(true);
    try {
      await api.notifications.testEmail(testEmail);
      toast.success(`Test email sent to ${testEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setTesting(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      await api.notifications.testSms(testPhone);
      toast.success(`Test SMS sent to ${testPhone}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test SMS");
    } finally {
      setTesting(false);
    }
  };

  if (loading || smtpLoading || smsConfigLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="email" className="space-y-6">
      <TabsList>
        <TabsTrigger value="email" className="gap-2">
          <Mail className="size-4" />
          Email
        </TabsTrigger>
        <TabsTrigger value="sms" className="gap-2">
          <MessageSquare className="size-4" />
          SMS
        </TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
      </TabsList>

      {/* ─── EMAIL TAB ───────────────────────────────────── */}
      <TabsContent value="email" className="space-y-6">
        {isSuperUser && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>SMTP Server Configuration</CardTitle>
              <CardDescription>
                Global SMTP settings used by all tenants for sending email notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig((p) => ({ ...p, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig((p) => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input
                    value={smtpConfig.username}
                    onChange={(e) => setSmtpConfig((p) => ({ ...p, username: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={smtpConfig.fromEmail}
                    onChange={(e) => setSmtpConfig((p) => ({ ...p, fromEmail: e.target.value }))}
                    placeholder="alerts@company.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>From Name</Label>
                  <Input
                    value={smtpConfig.fromName}
                    onChange={(e) => setSmtpConfig((p) => ({ ...p, fromName: e.target.value }))}
                    placeholder="MST-VTS"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={smtpConfig.secure}
                  onCheckedChange={(v) => setSmtpConfig((p) => ({ ...p, secure: v }))}
                />
                <Label className="text-sm">Enable TLS</Label>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSmtp} disabled={smtpSaving}>
                  {smtpSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save SMTP Config
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Enable email alerts and configure recipients for this tenant.
                </CardDescription>
              </div>
              <Switch
                checked={settings?.emailEnabled ?? false}
                onCheckedChange={(v) => update({ emailEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Default Recipients</Label>
              <EmailChipInput
                value={settings?.emailGlobalRecipients ?? []}
                onChange={(emailGlobalRecipients) => update({ emailGlobalRecipients })}
                placeholder="Add email address and press Enter"
              />
            </div>
            <div>
              <Label className="mb-2 block">Per-Event Overrides</Label>
              <EventOverridesTable
                overrides={settings?.emailEventOverrides ?? {}}
                onChange={(emailEventOverrides) => update({ emailEventOverrides })}
                globalRecipients={settings?.emailGlobalRecipients ?? []}
                channelLabel="Email"
              />
            </div>
            <div>
              <Label className="mb-2 block">Test Email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="max-w-xs"
                />
                <Button variant="outline" onClick={handleTestEmail} disabled={testing || !testEmail}>
                  {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                  Send Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </TabsContent>

      {/* ─── SMS TAB ─────────────────────────────────────── */}
      <TabsContent value="sms" className="space-y-6">
        {isSuperUser && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>SMS Gateway Configuration</CardTitle>
              <CardDescription>
                Global SMS settings used by all tenants for sending SMS notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={smsConfig.apiKey}
                    onChange={(e) => setSmsConfig((p) => ({ ...p, apiKey: e.target.value }))}
                    placeholder="Your SpringEdge API key"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Sender ID</Label>
                  <Input
                    value={smsConfig.senderId}
                    onChange={(e) => setSmsConfig((p) => ({ ...p, senderId: e.target.value }))}
                    placeholder="SPREDG"
                    maxLength={11}
                  />
                </div>
              </div>
              <div className="grid gap-2 max-w-[200px]">
                <Label>Message Type</Label>
                <Select
                  value={smsConfig.type}
                  onValueChange={(v) => setSmsConfig((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactional">Transactional</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSmsConfig} disabled={smsConfigSaving}>
                  {smsConfigSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save SMS Config
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>SMS Notifications</CardTitle>
                <CardDescription>
                  Enable SMS alerts and configure recipients for this tenant.
                </CardDescription>
              </div>
              <Switch
                checked={settings?.smsEnabled ?? false}
                onCheckedChange={(v) => update({ smsEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Default Recipients (E.164 format: +91XXXXXXXXXX)</Label>
              <EmailChipInput
                value={settings?.smsGlobalRecipients ?? []}
                onChange={(smsGlobalRecipients) => update({ smsGlobalRecipients })}
                placeholder="+919876543210"
              />
            </div>
            <div>
              <Label className="mb-2 block">Per-Event Overrides</Label>
              <EventOverridesTable
                overrides={settings?.smsEventOverrides ?? {}}
                onChange={(smsEventOverrides) => update({ smsEventOverrides })}
                globalRecipients={settings?.smsGlobalRecipients ?? []}
                channelLabel="SMS"
              />
            </div>
            <div>
              <Label className="mb-2 block">Test SMS</Label>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="max-w-xs"
                />
                <Button variant="outline" onClick={handleTestSms} disabled={testing || !testPhone}>
                  {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                  Send Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </TabsContent>

      {/* ─── LOGS TAB ────────────────────────────────────── */}
      <TabsContent value="logs" className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notification Logs</CardTitle>
                <CardDescription>{logsMeta.total} total notifications sent</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadLogs(1)} disabled={logsLoading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications sent yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Time</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {EVENT_TYPE_LABELS[log.eventType] ?? log.eventType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={log.channel === "email" ? "default" : "outline"}
                              className="capitalize"
                            >
                              {log.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {log.recipients.join(", ")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === "sent" ? "success" : log.status === "failed" ? "destructive" : "secondary"
                              }
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {logsMeta.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" disabled={logsMeta.page <= 1} onClick={() => loadLogs(logsMeta.page - 1)}>
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground py-2">
                      Page {logsMeta.page} of {logsMeta.totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={logsMeta.page >= logsMeta.totalPages} onClick={() => loadLogs(logsMeta.page + 1)}>
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
