import { createContext, useContext } from "react";
import type { AuthUser, LogInInput, SignUpInput } from "./api";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Ask the server again (e.g. before a protected step). Resolves with the user, or null. */
  refresh: () => Promise<AuthUser | null>;
  logIn: (input: LogInInput) => Promise<AuthUser>;
  signUp: (input: SignUpInput) => Promise<AuthUser>;
  logOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
