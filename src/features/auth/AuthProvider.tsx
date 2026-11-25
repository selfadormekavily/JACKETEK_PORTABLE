import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "./api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./context";

/**
 * Who is signed in, for the whole site. Asks the server once on load
 * (GET /api/auth/session reads the HttpOnly cookie) and updates
 * immediately on log-in, sign-up and log-out.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<api.AuthUser | null>(null);

  const apply = useCallback((next: api.AuthUser | null) => {
    setUser(next);
    setStatus(next ? "authenticated" : "anonymous");
    return next;
  }, []);

  const refresh = useCallback(
    () =>
      api
        .fetchSession()
        .then(({ user }) => apply(user))
        // Server unreachable: treat as signed out (it re-checks on every request anyway).
        .catch(() => apply(null)),
    [apply],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      refresh,
      logIn: async (input) => apply((await api.logIn(input)).user) as api.AuthUser,
      signUp: async (input) => apply((await api.signUp(input)).user) as api.AuthUser,
      logOut: async () => {
        await api.logOut().catch(() => undefined);
        apply(null);
      },
    }),
    [status, user, refresh, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
