"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Sparkles } from "lucide-react";
import { useTenant } from "@/components/tenant/tenant-provider";
import { ContactFooter } from "@/components/layout/contact-footer";

/**
 * Public layout for unauthenticated pages (live map, etc.)
 * Resolves tenant from subdomain, shows loading while resolving.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { resolved, tenant, slug, error } = useTenant();

  if (!resolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (slug && error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-6" aria-hidden="true" />
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            MST<span className="text-primary">-VTS</span>
          </span>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Organization not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            The subdomain <span className="font-semibold">{slug}</span> does not match
            any active organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-2.5 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          MST<span className="text-primary">-VTS</span>
        </span>
        {tenant && (
          <span className="ml-2 text-sm text-muted-foreground">
            {tenant.name}
          </span>
        )}
      </header>
      <main className="flex-1 min-h-0 relative">{children}</main>
      <div className="border-t px-4 py-3">
        <ContactFooter />
      </div>
    </div>
  );
}
