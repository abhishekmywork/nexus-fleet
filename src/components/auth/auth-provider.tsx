"use client";

import * as React from "react";
import type { LoginResponse, User } from "@/lib/auth-types";
import {
  api,
  clearSession,
  getRefreshToken,
  getStoredUser,
  setSession,
  UNAUTHORIZED_EVENT,
} from "@/lib/api";
import { useHydrated } from "@/hooks/use-hydrated";

export type TwoFactorChallengeInfo = {
  twoFactorToken: string;
  method: string;
  devCode?: string;
  sentTo?: string;
};

export type LoginOutcome =
  | { status: "success" }
  | { status: "two-factor"; challenge: TwoFactorChallengeInfo };

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  completeTwoFactor: (twoFactorToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function isTwoFactorChallenge(
  result: LoginResponse | { twoFactorRequired: true },
): result is { twoFactorRequired: true } {
  return "twoFactorRequired" in result && result.twoFactorRequired === true;
}

/**
 * Restores the persisted session lazily so the initial server/client
 * render can't mismatch (SSR always sees `null`).
 */
function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  return getStoredUser();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(readStoredUser);
  const hydrated = useHydrated();

  // Status is derived: "loading" until hydration, then authenticated when a
  // user is present. The session is re-validated against /auth/me below.
  const status: AuthStatus = !hydrated
    ? "loading"
    : user
      ? "authenticated"
      : "unauthenticated";

  // Re-validate the restored session in the background. On a hard 401 the
  // api client clears storage and emits UNAUTHORIZED_EVENT, handled below.
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .me()
      .then((fresh) => {
        if (cancelled) return;
        setUser(fresh);
        const token = localStorage.getItem("nexus_access_token");
        const refresh = localStorage.getItem("nexus_refresh_token");
        if (token && refresh) setSession(token, refresh, fresh);
      })
      .catch(() => {
        // handled by the UNAUTHORIZED_EVENT listener
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    if (isTwoFactorChallenge(result)) {
      return {
        status: "two-factor" as const,
        challenge: {
          twoFactorToken: result.twoFactorToken,
          method: result.method,
          devCode: result.devCode,
          sentTo: result.sentTo,
        },
      };
    }
    const session = result as LoginResponse;
    setSession(session.accessToken, session.refreshToken, session.user);
    setUser(session.user);
    return { status: "success" as const };
  }, []);

  const completeTwoFactor = React.useCallback(
    async (twoFactorToken: string, code: string) => {
      const session = await api.verifyTwoFactorLogin({ twoFactorToken, code });
      setSession(session.accessToken, session.refreshToken, session.user);
      setUser(session.user);
    },
    [],
  );

  const logout = React.useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      api.logout(refreshToken).catch(() => {});
    }
    clearSession();
    setUser(null);
  }, []);

  const can = React.useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.isSuperUser) return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, status, login, completeTwoFactor, logout, can }),
    [user, status, login, completeTwoFactor, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
