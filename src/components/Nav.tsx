import { useEffect, useState, type CSSProperties } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AccountMenuSheetItem, AccountNavItem } from "@/components/AccountMenu";
import Atmosphere from "@/components/Atmosphere";
import LanguageSwitch from "@/components/LanguageSwitch";
import Wordmark from "@/components/Wordmark";
import { useCart } from "@/features/cart/context";
import { pad2 } from "@/i18n/format";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

// "About" returns here once it has a page (it was an inert "#" link).
const NAV_LINKS: readonly { id: "home" | "design" | "cart"; to?: string }[] = [
  { id: "home", to: ROUTES.home },
  { id: "design", to: ROUTES.design },
  { id: "cart", to: ROUTES.cart },
];

/** "Cart 02": the number of jackets in the cart, as in the design. */
function NavLabel({ id }: { id: (typeof NAV_LINKS)[number]["id"] }) {
  const { count } = useCart();
  const { t, tp } = useI18n();
  if (id !== "cart") return <>{t(`nav.${id}`)}</>;
  return (
    <>
      {t("nav.cart")}{" "}
      <bdi dir="ltr" aria-label={tp("nav.cartCountAria", count)}>
        {pad2(Math.min(count, 99))}
      </bdi>
    </>
  );
}

type NavProps = {
  /**
   * "overlay": the homepage — transparent over the hero, then a light
   * fill that follows the story's studio (light / dark / paper).
   * "stage": the Design page — over the product stage only (the panel
   * beside it has its own top row), transparent.
   * "page": plain pages (cart, checkout) — always the light fill.
   */
  variant?: "overlay" | "stage" | "page";
};

/**
 * Fixed top navigation (design spec §9): logo left, (hero only) the
 * collection label centre, links right. 84px over the hero, 76px after;
 * no blur. Its colours follow the page ink (--fid-ink), so it turns light
 * over the dark studio. Small screens get a full-screen menu.
 */
export default function Nav({ variant = "overlay" }: NavProps) {
  const overHero = useOverHero(variant === "overlay");
  const overFooter = useOverFooter(variant === "overlay");
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { t } = useI18n();

  // Close the menu on navigation; lock page scroll while it's open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stage = variant === "stage";
  const filled = variant === "page" || (variant === "overlay" && !overHero && !overFooter);

  return (
    <>
      <header
        className={`fixed start-0 z-30 grid h-[60px] grid-cols-[1fr_auto] items-center px-5 transition-[height,background-color,border-color] duration-[250ms] md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-14 xl:grid-cols-3 ${stage ? "lg:max-xl:grid-cols-[auto_minmax(0,1fr)_auto] lg:max-xl:px-8" : ""} ${
          overHero ? "md:h-[84px]" : "md:h-[76px]"
        } ${stage ? "jk-nav-stage end-0 top-[6px] cfg:end-[var(--cfg-panel)]" : "end-0 top-0"} ${overFooter ? "jk-world-navy" : ""}`}
        // The configurator bar is styled by .jk-nav-stage (frosted on phones and tablets, clear beside the panel).
        style={filled ? FILLED : stage ? undefined : TRANSPARENT}
      >
        <Link to={ROUTES.home} aria-label={t("nav.homeAria")} className="jk-hit relative z-10 justify-self-start">
          <span className="md:hidden">
            <Wordmark compact />
          </span>
          <span className={`hidden md:inline ${stage ? "lg:max-xl:hidden" : ""}`}>
            <Wordmark />
          </span>
          {/* Beside the 480px configurator panel the bar is short until xl: the tag alone. */}
          {stage && (
            <span className="hidden lg:max-xl:inline">
              <Wordmark tagOnly />
            </span>
          )}
        </Link>

        <p
          className={`jk-label hidden justify-self-center text-jk-muted transition-opacity duration-300 xl:block ${
            overHero ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!overHero}
        >
          {t("nav.collection")}
        </p>

        <nav aria-label={t("nav.primaryAria")} className="hidden justify-self-end md:block">
          <ul className={`flex items-center ${stage ? "gap-[30px] lg:max-xl:gap-5" : "gap-9"} max-lg:gap-6 rtl:max-lg:gap-5`}>
            {NAV_LINKS.map(({ id, to }) => (
              <li key={id}>
                {to ? (
                  <NavLink to={to} end className="jk-label jk-nav-link jk-nav-rule whitespace-nowrap" style={INK}>
                    <NavLabel id={id} />
                  </NavLink>
                ) : (
                  <a href="#" className="jk-label jk-nav-link jk-nav-rule whitespace-nowrap" style={INK}>
                    <NavLabel id={id} />
                  </a>
                )}
              </li>
            ))}
            <li>
              <AccountNavItem />
            </li>
            <li>
              <LanguageSwitch />
            </li>
          </ul>
        </nav>

        {/* Phones (design §9): the language (one tap), the cart count, "Menu". */}
        <div className="relative z-10 flex items-center gap-4 justify-self-end max-[379px]:gap-3 md:hidden">
          <LanguageSwitch variant="toggle" />
          <Link to={ROUTES.cart} className="jk-label grid min-h-11 place-items-center" style={{ ...INK, fontSize: 10 }}>
            <span>
              <NavLabel id="cart" />
            </span>
          </Link>
          <button
            type="button"
            className="jk-label min-h-11"
            style={{ ...INK, fontSize: 10 }}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {t("nav.menu")}
          </button>
        </div>
      </header>

      {/* Small screens: a full-screen paper sheet, items in headline type
          with dashed separators; fades in while sliding 24px. */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.menuDialogAria")}
        className={`fixed inset-0 z-40 flex flex-col bg-jk-paper px-5 pb-[max(24px,env(safe-area-inset-bottom))] transition-[opacity,visibility,transform] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-6 opacity-0"
        }`}
        // Always the Cream world (the page may be in a dark one behind it).
        style={LIGHT_WORLD}
      >
        <Atmosphere className="jk-atmos--page absolute inset-0" />
        {/* The same header row as the page: logo left, close right. */}
        <div className="relative flex h-[60px] shrink-0 items-center justify-between">
          <Link to={ROUTES.home} onClick={() => setOpen(false)} aria-label={t("nav.homeAria")} tabIndex={open ? undefined : -1} className="jk-hit">
            <Wordmark compact />
          </Link>
          <button
            type="button"
            aria-label={t("nav.closeMenuAria")}
            onClick={() => setOpen(false)}
            className="-me-3 grid h-11 w-11 place-items-center text-[24px] leading-none text-jk-ink"
            tabIndex={open ? undefined : -1}
          >
            ×
          </button>
        </div>
        <ul className="relative mt-6 flex flex-col">
          {NAV_LINKS.map(({ id, to }, i) => (
            <li key={id} className={`jk-menu-item jk-dashed-top py-[9px] ${i === NAV_LINKS.length - 1 ? "jk-dashed-bottom" : ""}`}>
              <Link
                to={to ?? "#"}
                onClick={() => setOpen(false)}
                className="jk-headline jk-hit block text-[40px] text-jk-ink"
                tabIndex={open ? undefined : -1}
              >
                <NavLabel id={id} />
              </Link>
            </li>
          ))}
        </ul>
        <div className="jk-menu-account relative mt-8">
          <AccountMenuSheetItem open={open} onDone={() => setOpen(false)} />
        </div>
        <div className="relative mt-8 flex items-center justify-between gap-4">
          <span className="jk-label-xs text-jk-muted">{t("language.label")}</span>
          <LanguageSwitch variant="sheet" tabIndex={open ? undefined : -1} />
        </div>
        <p className="jk-label relative mt-auto text-jk-muted" style={{ fontSize: 10 }}>
          {t("nav.collection")}
        </p>
      </div>
    </>
  );
}

/** The Cream world's type roles, for light surfaces over any chapter. */
const LIGHT_WORLD = {
  "--fid-ink": "var(--brand-navy)",
  "--fid-ink-inverse": "var(--brand-cream)",
  "--t-head": "var(--brand-navy)",
  "--t-accent": "var(--brand-crimson)",
  "--t-body": "var(--brand-navy)",
  "--t-muted": "var(--brand-navy-soft)",
  "--t-numeral": "var(--brand-navy-soft)",
  "--t-on-head": "var(--brand-cream)",
  "--t-link": "var(--brand-crimson)",
  "--t-rule": "var(--brand-red)",
  "--t-stitch": "var(--brand-crimson)",
} as CSSProperties;

const INK: CSSProperties = { color: "rgb(var(--fid-ink))" };

const TRANSPARENT: CSSProperties = {
  backgroundColor: "transparent",
  borderBottom: "1px solid transparent",
};

/**
 * After the hero: the light fill (70 %), solid over the paper of 03, and
 * none in the dark studio — where the text turns light and the hairline
 * follows it.
 */
const FILLED: CSSProperties = {
  backgroundColor:
    // The current mood's light (apricot, rose, lavender…), so the bar is
    // part of the scene rather than a grey band over it.
    "rgb(var(--bg-c0) / calc((0.72 + 0.2 * var(--jk-paper, 0)) * (1 - var(--jk-dark, 0))))",
  borderBottom: "1px solid rgb(var(--fid-ink) / 0.12)",
};

/**
 * True once the page's story has scrolled up past the bar, so it sits over
 * the navy footer: it then drops its cream fill and takes the navy world's
 * cream ink.
 */
function useOverFooter(enabled: boolean) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setOver(false);
      return;
    }
    const update = () => {
      const main = document.querySelector("main");
      setOver(!!main && main.getBoundingClientRect().bottom < 76);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);
  return over;
}

/**
 * True while the homepage hero is on screen (until 60 % of a viewport
 * has scrolled — the hero's words leave by then).
 */
function useOverHero(enabled: boolean) {
  const [over, setOver] = useState(enabled);
  useEffect(() => {
    if (!enabled) {
      setOver(false);
      return;
    }
    const update = () => setOver(window.scrollY < window.innerHeight * 0.6);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [enabled]);
  return over;
}
