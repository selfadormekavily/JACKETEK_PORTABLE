/**
 * The account API (server/auth.mjs). The session itself is an HttpOnly
 * cookie the browser sends automatically: nothing about it is ever
 * readable from, or stored by, this code.
 */
export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export type Identifier = { method: "email"; email: string } | { method: "phone"; phone: { country: string; number: string } };

export type SignUpInput = Identifier & { firstName: string; lastName: string; password: string };
export type LogInInput = Identifier & { password: string };

/**
 * A failed request: a message, and per-field messages when the server sent
 * them. The messages are the API's English; the UI localizes them
 * (i18n/serverErrors). Status 0 = the server couldn't be reached.
 */
export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      // The custom header proves the request comes from this site (CSRF).
      headers: body === undefined ? {} : { "Content-Type": "application/json", "X-Jacketek-Auth": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AuthRequestError("We couldn't reach JACKETEK. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthRequestError(data.error ?? "Something went wrong. Please try again.", res.status, data.fields ?? {});
  return data as T;
}

export const fetchSession = () => request<{ user: AuthUser | null }>("/api/auth/session");
export const signUp = (input: SignUpInput) => request<{ user: AuthUser }>("/api/auth/signup", input);
export const logIn = (input: LogInInput) => request<{ user: AuthUser }>("/api/auth/login", input);
export const logOut = () => request<{ ok: true }>("/api/auth/logout", {});
