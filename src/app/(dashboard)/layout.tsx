import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import type { ReactNode } from "react";

/**
 * Layout for the admin area. Requires authentication and wraps every route
 * below in the app shell (sidebar + header + footer).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
