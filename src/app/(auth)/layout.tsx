import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Standalone layout for auth routes (login, etc.) — full-screen centered
 * card with a branded header, outside the admin app shell.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <Link
        href="/login"
        className="flex items-center gap-2.5"
        aria-label="MST-VTS home"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>
        <span className="text-2xl font-semibold tracking-tight">
          MST<span className="text-primary">-VTS</span>
        </span>
      </Link>

      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
