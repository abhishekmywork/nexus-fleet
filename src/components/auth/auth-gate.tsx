"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Route guard for the admin area. While the session is being restored it
 * shows a branded splash; once it resolves, unauthenticated visitors are
 * redirected to the login page.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();

  React.useEffect(() => {
    if (hydrated && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [hydrated, status, router]);

  if (!hydrated || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Redirect is handled by the effect above.
    return null;
  }

  return <>{children}</>;
}
