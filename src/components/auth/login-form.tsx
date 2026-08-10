"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogIn, Mail, ShieldCheck, Sparkles, UserPlus, Building2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useTenant } from "@/components/tenant/tenant-provider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type Mode = "signin" | "register" | "two-factor";

/**
 * Authentication card: sign in, create an account, and the 2FA challenge
 * step shown when an account has a second factor enabled.
 */
export function LoginForm() {
  const router = useRouter();
  const { login, completeTwoFactor, logout } = useAuth();
  const { tenant, slug, resolved, error: tenantError } = useTenant();

  const [mode, setMode] = React.useState<Mode>("signin");
  const [pending, setPending] = React.useState(false);

  // Sign in / register fields.
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // 2FA challenge fields.
  const [challenge, setChallenge] = React.useState<{
    twoFactorToken: string;
    method: string;
    devCode?: string;
    sentTo?: string;
  } | null>(null);
  const [code, setCode] = React.useState("");

  const reset = React.useCallback(() => {
    setMode("signin");
    setChallenge(null);
    setCode("");
    setPending(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      if (mode === "register") {
        const res = await api.register({
          email,
          password,
          firstName,
          lastName,
        });
        toast.success(`Account created for ${res.user.email}. You can now sign in.`);
        setFirstName("");
        setLastName("");
        setPassword("");
        setMode("signin");
        return;
      }

      const outcome = await login(email, password);
      if (outcome.status === "two-factor") {
        setChallenge(outcome.challenge);
        setMode("two-factor");
        toast.info("Two-factor verification required");
      } else {
        toast.success("Signed in successfully");
        router.replace("/live-map");
      router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setPending(true);
    try {
      await completeTwoFactor(challenge.twoFactorToken, code);
      toast.success("Signed in successfully");
      router.replace("/live-map");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setPending(false);
    }
  };

  // Show loading state while resolving tenant
  if (!resolved) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <CardTitle className="pt-2 text-muted-foreground">Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Show error if subdomain doesn't match any tenant
  if (slug && tenantError) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="items-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <CardTitle className="pt-2">Organization not found</CardTitle>
          <CardDescription>
            The subdomain <span className="font-semibold">{slug}</span> does not match
            any active organization on this platform.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      {mode === "two-factor" && challenge ? (
        <>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <CardTitle className="pt-2">Two-factor verification</CardTitle>
            <CardDescription>
              Enter the {challenge.method.toUpperCase()} code
              {challenge.sentTo ? (
                <>
                  {" "}
                  sent to <span className="font-medium">{challenge.sentTo}</span>
                </>
              ) : (
                " from your authenticator app"
              )}{" "}
              to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {challenge.devCode && (
              <div className="mb-4 rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Development code
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-widest">
                  {challenge.devCode}
                </p>
              </div>
            )}
            <form onSubmit={handleVerify} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="otp-code">Verification code</Label>
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="h-12 text-center font-mono text-lg tracking-[0.4em]"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" disabled={pending || code.length < 6}>
                {pending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                Verify & continue
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <button
              type="button"
              onClick={() => {
                logout().catch(() => {});
                reset();
              }}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </button>
          </CardFooter>
        </>
      ) : (
        <>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {tenant ? <Building2 className="size-5" aria-hidden="true" /> : <Sparkles className="size-5" aria-hidden="true" />}
            </div>
            <CardTitle className="pt-2">
              {mode === "register"
                ? "Create your account"
                : tenant
                  ? `Sign in to ${tenant.name}`
                  : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {mode === "register"
                ? "Sign up to start managing your workspace."
                : tenant
                  ? `Access the ${tenant.name} dashboard.`
                  : "Sign in to access your dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 pl-9"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 pl-9"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={pending} className="mt-1">
                {pending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                {mode === "register" ? (
                  <>
                    <UserPlus className="mr-2 size-4" aria-hidden="true" /> Create account
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 size-4" aria-hidden="true" /> Sign in
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            {mode === "register" ? (
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </p>
            ) : !tenant ? (
              <p className="text-sm text-muted-foreground">
                New to MST-VTS?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create an account
                </button>
              </p>
            ) : null}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
