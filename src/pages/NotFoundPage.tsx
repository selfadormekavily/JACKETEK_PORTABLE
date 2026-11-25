import { Link } from "react-router-dom";
import Atmosphere from "@/components/Atmosphere";
import Nav from "@/components/Nav";
import { Trans } from "@/i18n/Trans";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

export default function NotFoundPage() {
  const { t } = useI18n();
  useDocumentTitle("meta.title.notFound");
  return (
    <>
      <Nav />
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-5 text-center">
        <Atmosphere className="jk-atmos--center absolute inset-0" />
        {/* The page's one deep-red moment: an oversized numeral pressed into the room. */}
        <p aria-hidden="true" className="jk-display jk-pressed-numeral relative text-[clamp(180px,34vw,420px)]">
          404
        </p>
        <div className="relative -mt-[clamp(70px,12vw,150px)] flex flex-col items-center gap-6">
          <span className="jk-label text-jk-red">{t("notFound.eyebrow")}</span>
          <h1 className="jk-headline text-[clamp(40px,6vw,80px)] text-jk-ink">
            <Trans k="notFound.title" tags={{ accent: (c) => <span className="block text-jk-taupe">{c}</span> }} />
          </h1>
          <Link to={ROUTES.home} className="jk-btn-primary relative mt-4 w-[320px]">
            {t("notFound.cta")}
            <svg aria-hidden="true" className="jk-arrow" width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9 H15 M10 4 L15 9 L10 14" />
            </svg>
          </Link>
        </div>
      </main>
    </>
  );
}
