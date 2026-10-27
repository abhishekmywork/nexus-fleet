/**
 * Shared hostname → tenant-slug resolution.
 *
 * The platform serves two things on the same wildcard domain:
 *   - `mstechind.com` / `www.mstechind.com`  → the Laravel mstVts site (host nginx)
 *   - `<tenant>.mstechind.com`               → a tenant dashboard
 *   - `admin.mstechind.com`                  → the super-admin panel (no tenant)
 *
 * Reserved hostnames are *not* tenants, so they must resolve to `null`
 * (the super-admin context) instead of triggering a tenant lookup.
 */

export const RESERVED_SUBDOMAINS: readonly string[] = [
  "admin",
  "www",
  "app",
  "api",
  "fleet",
];

export function isReservedSubdomain(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return RESERVED_SUBDOMAINS.includes(slug.toLowerCase());
}

/**
 * Returns the tenant slug for a hostname, or `null` when the hostname
 * belongs to the root domain, a reserved host, an IP, or localhost.
 *
 * - `ranaghat.mstechind.com` → `ranaghat`
 * - `admin.mstechind.com`    → `null`
 * - `mstechind.com`          → `null`
 * - `147.93.31.140`          → `null`
 * - `localhost`              → `null`
 */
export function extractTenantSlug(hostname: string | null | undefined): string | null {
  if (!hostname) return null;

  // Skip IPv4 / IPv6 literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  if (hostname.includes(":")) return null;

  if (hostname === "localhost") return null;

  const parts = hostname.split(".");
  // Need at least 3 parts for a subdomain (sub.domain.tld)
  if (parts.length < 3) return null;

  const slug = parts[0].toLowerCase();
  if (!slug || isReservedSubdomain(slug)) return null;

  return slug;
}
