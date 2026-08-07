"use client";

import * as React from "react";
import { Loader2, ShieldCheck, ShieldOff, Mail, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { User } from "@/lib/auth-types";

interface TwoFactorSettingsProps {
  user: User;
  onUpdated: (user: User) => void;
}

export function TwoFactorSettings({ user, onUpdated }: TwoFactorSettingsProps) {
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [method, setMethod] = React.useState<"email" | "sms">("email");
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [setupInfo, setSetupInfo] = React.useState<{
    sentTo: string;
    devCode?: string;
  } | null>(null);

  const handleBeginSetup = async () => {
    setPending(true);
    try {
      const res = await api.twoFactorSetup(method);
      setSetupInfo({ sentTo: res.sentTo, devCode: res.devCode });
      setCode("");
      toast.success(`Code sent to ${res.sentTo}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setPending(false);
    }
  };

  const handleConfirmSetup = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setPending(true);
    try {
      await api.twoFactorVerify(code);
      toast.success("Two-factor authentication enabled");
      setSetupOpen(false);
      setSetupInfo(null);
      setCode("");
      const me = await api.me();
      onUpdated(me);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setPending(false);
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setPending(true);
    try {
      await api.twoFactorDisable(code);
      toast.success("Two-factor authentication disabled");
      setDisableOpen(false);
      setCode("");
      const me = await api.me();
      onUpdated(me);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setPending(false);
    }
  };

  const openSetup = () => {
    setSetupInfo(null);
    setCode("");
    setMethod("email");
    setSetupOpen(true);
  };

  const openDisable = () => {
    setCode("");
    setDisableOpen(true);
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account by requiring a
            verification code at login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Status</p>
                <Badge variant={user.twoFactorEnabled ? "success" : "secondary"}>
                  {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {user.twoFactorEnabled && (
                <p className="text-xs text-muted-foreground">
                  Method:{" "}
                  {user.twoFactorMethod === "sms" ? (
                    <span className="flex items-center gap-1 inline-flex">
                      <Smartphone className="size-3" /> SMS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 inline-flex">
                      <Mail className="size-3" /> Email
                    </span>
                  )}
                </p>
              )}
            </div>
            {user.twoFactorEnabled ? (
              <Button variant="outline" size="sm" onClick={openDisable}>
                <ShieldOff className="mr-2 size-4" />
                Disable
              </Button>
            ) : (
              <Button size="sm" onClick={openSetup}>
                <ShieldCheck className="mr-2 size-4" />
                Enable
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Choose a method to receive your verification codes.
            </DialogDescription>
          </DialogHeader>

          {!setupInfo ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Method</Label>
                <Select
                  value={method}
                  onValueChange={(v) => setMethod(v as "email" | "sms")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <span className="flex items-center gap-2">
                        <Mail className="size-4" /> Email ({user.email})
                      </span>
                    </SelectItem>
                    <SelectItem value="sms" disabled={!user.phone}>
                      <span className="flex items-center gap-2">
                        <Smartphone className="size-4" /> SMS
                        {user.phone ? ` (${user.phone})` : " (no phone number)"}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBeginSetup} disabled={pending}>
                  {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Send Code
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A 6-digit code has been sent to{" "}
                <span className="font-medium text-foreground">
                  {setupInfo.sentTo}
                </span>
                .
              </p>
              {setupInfo.devCode && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Dev mode — your code:{" "}
                    <span className="font-mono text-sm">{setupInfo.devCode}</span>
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="setup-code">Verification code</Label>
                <Input
                  id="setup-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmSetup();
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSetupInfo(null);
                    setCode("");
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirmSetup}
                  disabled={pending || code.length !== 6}
                >
                  {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Enable 2FA
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your current verification code to disable 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="disable-code">Verification code</Label>
              <Input
                id="disable-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDisable();
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisableOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={pending || code.length !== 6}
              >
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Disable 2FA
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
