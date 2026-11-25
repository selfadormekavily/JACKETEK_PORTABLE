import { Link } from "react-router-dom";
import { CREAM_THREAD } from "@/components/ThreadDyes";
import type { TKey } from "@/i18n/context";
import { Trans } from "@/i18n/Trans";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

type FooterLink = { label: TKey; to?: string; href?: string };

const COLUMNS: readonly { title: TKey; links: readonly FooterLink[] }[] = [
  {
    title: "footer.columns.explore",
    links: [
      { label: "footer.links.home", to: ROUTES.home },
      { label: "footer.links.design", to: ROUTES.design },
    ],
  },
  {
    title: "footer.columns.studio",
    links: [
      // Placeholders until the real address / profile are provided.
      { label: "footer.links.contact" },
      { label: "footer.links.instagram" },
      { label: "footer.links.cart", to: ROUTES.cart },
    ],
  },
];

const LINK = "jk-label jk-nav-link text-jk-ink transition-colors duration-200 hover:text-jk-accent";

/**
 * Closing footer on the page canvas with grain: a line to remember, a few
 * quiet links, and the embroidered wordmark as the last thing on the
 * page.
 *
 * On larger screens the homepage keeps it pinned to the bottom of the
 * viewport (the story lifts away to uncover it). It is three quarters of a
 * viewport tall, so it reads as a closing band rather than a whole screen
 * of navy. A column: the words at the top, the footer rule at the bottom,
 * and the wordmark taking the height left between them, scaled to fit.
 */
export default function SiteFooter({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <footer
      className={`jk-world-navy jk-seam relative flex flex-col overflow-hidden bg-jk-navy md:h-[76svh] ${className}`}
      // Always the Navy world, as the story ends in (no seam between them).
      style={{ background: "var(--bg-studio)" }}
    >
      <div aria-hidden="true" className="jk-grain absolute inset-0" />
      <div className="relative mx-5 flex flex-col gap-14 pt-[calc(60px+40px)] md:mx-14 md:flex-row md:items-end md:justify-between md:pt-[clamp(48px,8vh,88px)]">
        <div>
          <p className="jk-label flex items-center gap-4 text-jk-ink">
            {t("footer.brand")}
            <span aria-hidden="true" className="block h-px w-[50px] bg-jk-rule" />
          </p>
          <p className="jk-headline mt-6 text-[clamp(40px,5vw,72px)] text-jk-ink">
            <Trans
              k="footer.tagline"
              tags={{
                accent: (c) => (
                  <>
                    <br />
                    <span className="text-jk-taupe">{c}</span>
                  </>
                ),
              }}
            />
          </p>
        </div>
        <div className="flex gap-16 md:gap-24">
          {COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <p className="jk-label-xs text-jk-muted">{t(title)}</p>
              <ul className="mt-5 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* The wordmark fills the space left — as wide as the footer's own
          margins allow (aligned with the text and the rule, never cropped),
          never taller than the room it has, at most its design size — and
          is centred both ways. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center py-10 md:py-[clamp(12px,3vh,40px)]">
        <img
          src="/assets/embroidery/jacketek-wordmark-silver@2x.webp"
          alt=""
          aria-hidden="true"
          width={2960}
          height={860}
          decoding="async"
          loading="lazy"
          className="block h-auto w-[calc(100%-40px)] max-w-none select-none object-contain md:h-full md:max-h-[300px] md:w-auto md:max-w-[calc(100%-112px)]"
          style={{ filter: CREAM_THREAD }}
        />
      </div>
      <div
        className="jk-label relative mx-5 flex shrink-0 flex-wrap justify-between gap-4 py-5 text-jk-muted md:mx-14"
        style={{ borderTop: "1px dashed rgb(var(--t-rule))" }}
      >
        <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
        <span>{t("footer.small")}</span>
      </div>
    </footer>
  );
}

function FooterAnchor({ label: labelKey, to, href }: FooterLink) {
  const { t } = useI18n();
  const label = t(labelKey);
  if (to)
    return (
      <Link to={to} className={LINK}>
        {label}
      </Link>
    );
  const external = href?.startsWith("http");
  return (
    <a
      href={href ?? "#"}
      className={LINK}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {label}
    </a>
  );
}
