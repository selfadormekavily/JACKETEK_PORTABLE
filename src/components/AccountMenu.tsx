import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { authUrl, safeReturnTo } from "@/features/auth/returnTo";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

const INK: CSSProperties = { color: "rgb(var(--fid-ink))" };

/** "Log in" goes to auth and comes back to the page it was opened from. */
const useLoginHref = () => {
  const { pathname, search } = useLocation();
  return authUrl(safeReturnTo(`${pathname}${search}`));
};

/**
 * The nav's account entry (desktop). Signed out: "Log in". Signed in: the
 * customer's initial and first name, opening a small menu with Log out.
 * While the session check runs it keeps its space, so nothing shifts.
 */
export function AccountNavItem() {
  const { status, user, logOut } = useAuth();
  const { t } = useI18n();
  const loginHref = useLoginHref();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "authenticated" || !user) {
    return (
      <Link
        to={loginHref}
        className={`jk-label jk-nav-link jk-nav-rule whitespace-nowrap ${status === "loading" ? "invisible" : ""}`}
        style={INK}
      >
        {t("account.logIn")}
      </Link>
    );
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.menuAria")}
        onClick={() => setOpen((o) => !o)}
        className="jk-label jk-nav-link jk-nav-rule flex items-center gap-[10px] whitespace-nowrap"
        style={INK}
      >
        <span aria-hidden="true" className="jk-account-initial">
          {user.firstName.slice(0, 1)}
        </span>
        {/* dir="auto": a Latin name in the Arabic UI still truncates at its own end. */}
        <span dir="auto" className="max-w-[9ch] truncate">{user.firstName}</span>
      </button>
      {open && (
        <div role="menu" className="jk-account-menu">
          <p className="jk-label-xs text-jk-muted">{t("account.signedInAs")}</p>
          {/* An LTR block (so a long email truncates at its end), aligned to the reading start. */}
          <p dir="ltr" className="mt-1 truncate text-[14px] text-jk-ink rtl:text-right">
            {user.email ?? user.phone}
          </p>
          <Link to={ROUTES.groups} role="menuitem" onClick={() => setOpen(false)} className="jk-label jk-link mt-4 block text-jk-ink">
            {t("account.myGroups")}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logOut();
            }}
            className="jk-label jk-link mt-4 text-jk-ink"
          >
            {t("account.logOut")}
          </button>
        </div>
      )}
    </div>
  );
}

/** The same entry inside the phones' menu sheet. */
export function AccountMenuSheetItem({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { status, user, logOut } = useAuth();
  const { t } = useI18n();
  const loginHref = useLoginHref();
  if (status === "loading") return null;
  if (!user)
    return (
      <Link to={loginHref} onClick={onDone} className="jk-label jk-link text-jk-ink" tabIndex={open ? undefined : -1}>
        {t("account.logInOrCreate")}
      </Link>
    );
  return (
    <div className="flex items-end justify-between gap-4">
      <p className="min-w-0">
        <span className="jk-label-xs block text-jk-muted">{t("account.signedIn")}</span>
        <span className="mt-1 block truncate text-[15px] text-jk-ink">
          {user.firstName} {user.lastName}
        </span>
        <Link to={ROUTES.groups} onClick={onDone} className="jk-label jk-link mt-3 inline-block text-jk-ink" tabIndex={open ? undefined : -1}>
          {t("account.myGroups")}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          onDone();
          void logOut();
        }}
        className="jk-label jk-link shrink-0 text-jk-ink"
        tabIndex={open ? undefined : -1}
      >
        {t("account.logOut")}
      </button>
    </div>
  );
}
