"use client";

import * as React from "react";
import { Loader2, Save, Settings, Truck, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { NotificationSettings } from "./notification-settings";
import { GlobalSettings } from "./global-settings";
import { FleetDefaults } from "./fleet-defaults";
import { TwoFactorSettings } from "./two-factor-settings";
import type { User as UserType } from "@/lib/auth-types";

export function SettingsPanel() {
  const { user: authUser } = useAuth();
  const [user, setUser] = React.useState<UserType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Profile form state
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  React.useEffect(() => {
    async function load() {
      try {
        const me = await api.me();
        setUser(me);
        setFirstName(me.firstName);
        setLastName(me.lastName);
        setPhone(me.phone ?? "");
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword && !currentPassword) {
      toast.error("Current password is required to set a new password");
      return;
    }

    setSaving(true);
    try {
      const dto: Record<string, any> = {};
      if (firstName !== user?.firstName) dto.firstName = firstName;
      if (lastName !== user?.lastName) dto.lastName = lastName;
      if (phone !== (user?.phone ?? "")) dto.phone = phone;
      if (newPassword) {
        dto.currentPassword = currentPassword;
        dto.newPassword = newPassword;
      }

      if (Object.keys(dto).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      const updated = await api.updateProfile(dto);
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile"
      );
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

  const permissions = authUser?.permissions ?? [];
  const hasGlobalRead = permissions.includes("settings:global:read");
  const hasTenantRead = permissions.includes("settings:tenant:read");
  const hasNotificationsRead = permissions.includes("notifications:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, notifications, and system configuration."
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="size-4" />
            Profile
          </TabsTrigger>
          {hasNotificationsRead && (
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          )}
          {hasTenantRead && (
            <TabsTrigger value="fleet-defaults" className="gap-2">
              <Truck className="size-4" />
              Fleet Defaults
            </TabsTrigger>
          )}
          {hasGlobalRead && (
            <TabsTrigger value="global" className="gap-2">
              <Settings className="size-4" />
              Global Settings
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── PROFILE TAB ─────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your name and contact details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email ?? ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed here.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Leave blank to keep your current password.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-sm">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Save className="mr-2 size-4" />
                Save changes
              </Button>
            </div>
          </form>

          {user && <TwoFactorSettings user={user} onUpdated={setUser} />}
        </TabsContent>

        {/* ─── NOTIFICATIONS TAB ───────────────────────────── */}
        {hasNotificationsRead && (
          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        )}

        {/* ─── FLEET DEFAULTS TAB ──────────────────────────── */}
        {hasTenantRead && (
          <TabsContent value="fleet-defaults">
            <FleetDefaults />
          </TabsContent>
        )}

        {/* ─── GLOBAL SETTINGS TAB ─────────────────────────── */}
        {hasGlobalRead && (
          <TabsContent value="global">
            <GlobalSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
