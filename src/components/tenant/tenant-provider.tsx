"use client";

import * as React from "react";
import { extractTenantSlug } from "@/lib/tenant-host";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  publicLiveMap: boolean;
}

interface TenantContextValue {
  /** The resolved tenant, or null if on the root domain (super admin panel). */
  tenant: TenantInfo | null;
  /** The raw subdomain slug, or null if on the root domain. */
  slug: string | null;
  /** Whether the subdomain was valid and a tenant was found. */
  resolved: boolean;
  /** Error message if the subdomain was invalid. */
  error: string | null;
}

const TenantContext = React.createContext<TenantContextValue | null>(null);

/**
 * Extracts the tenant subdomain from the current browser hostname.
 * Reserved hosts (`admin`, `www`, `app`, `api`, `fleet`) resolve to `null`.
 *
 * - `ranaghat.mstechind.com` → `ranaghat`
 * - `admin.mstechind.com` → `null`
 * - `mstechind.com` → `null`
 * - `localhost` → `null`
 * - `147.93.31.140` → `null`
 */
function extractSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  return extractTenantSlug(window.location.hostname);
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = React.useState<TenantInfo | null>(null);
  const [resolved, setResolved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const slug = extractSubdomain();

  React.useEffect(() => {
    if (!slug) {
      setResolved(true);
      return;
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const base = API_BASE.replace(/\/api\/?$/, "");

    fetch(`${base}/api/tenants/public/by-slug/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Tenant not found");
        const data = await res.json();
        setTenant(data);
        setResolved(true);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Organization not found"
        );
        setResolved(true);
      });
  }, [slug]);

  const value = React.useMemo<TenantContextValue>(
    () => ({ tenant, slug, resolved, error }),
    [tenant, slug, resolved, error],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = React.useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return ctx;
}
