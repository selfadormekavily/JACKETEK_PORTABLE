import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Atmosphere from "@/components/Atmosphere";
import Wordmark from "@/components/Wordmark";
import { ROUTES } from "@/lib/routes";
import { hasSession, login, logout } from "./api";

/**
 * The admin's frame: not part of the customer site (no shop nav, never
 * linked, not indexed). Until the browser holds an admin session it shows
 * only the sign-in; the server checks the session on every request.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.append(meta);
    const title = document.title;
    document.title = "Admin — JACKETEK";
    hasSession().then(setSignedIn);
    return () => {
      meta.remove();
      document.title = title;
    };
  }, []);

  const signOut = async () => {
    await logout();
    setSignedIn(false);
  };

  return (
    <div className="relative min-h-screen text-jk-ink">
      <Atmosphere className="jk-atmos--page fixed inset-0" />
      <header className="jk-world-navy relative flex h-[76px] items-center justify-between bg-jk-navy px-5 md:px-14">
        <Link to={ROUTES.adminOrders} className="flex items-center gap-4">
          <Wordmark compact />
          <span className="jk-label text-jk-muted">Admin</span>
        </Link>
        {signedIn && (
          <button type="button" onClick={signOut} className="jk-label jk-link text-jk-ink">
            Sign out
          </button>
        )}
      </header>
      <main className="relative mx-auto w-full max-w-[1240px] px-5 py-10 md:px-14 md:py-14">
        {signedIn === null ? (
          <p className="jk-label text-jk-muted">Loading…</p>
        ) : signedIn ? (
          children
        ) : (
          <SignIn onSignedIn={() => setSignedIn(true)} />
        )}
      </main>
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(value.trim());
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-[420px]">
      <h1 className="text-[25px] font-medium uppercase tracking-[0.13em]">Admin sign in</h1>
      <label htmlFor="admin-key" className="jk-label mt-10 block" style={{ fontSize: 10 }}>
        Access key
      </label>
      <input
        id="admin-key"
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "admin-key-error" : undefined}
        className={`mt-2 h-[52px] w-full border bg-jk-raised px-4 text-[16px] outline-none focus:border-jk-ink ${
          error ? "border-jk-accent" : "border-[rgb(var(--t-head)/.22)]"
        }`}
      />
      {error && (
        <p id="admin-key-error" className="mt-2 text-[13px] text-jk-accent">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !value.trim()} className="jk-btn-primary mt-6 w-full">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
