import Atmosphere from "@/components/Atmosphere";
import OutlineText from "@/components/OutlineText";
import { pad2 } from "@/i18n/format";
import { Trans } from "@/i18n/Trans";
import { useI18n } from "@/i18n/useI18n";

/** Captions and alt text: locales studies.item.<id>. */
const STUDIES = [
  { id: "chenille", src: "/assets/studies/chenille.webp" },
  { id: "cuff", src: "/assets/studies/leather-cuff.webp" },
  { id: "collar", src: "/assets/studies/rib-collar.webp" },
] as const;

/**
 * After the story: three material studies, pinned like fabric swatches on
 * a studio wall, staggered under one faint outline word. Editorial
 * texture between the story and the footer, not a row of feature cards.
 */
export default function MaterialStudies() {
  const { t, isRtl } = useI18n();
  const word = t("studies.backdropWord");
  return (
    <section className="jk-studies jk-home" aria-labelledby="studies-title">
      <Atmosphere className="jk-atmos--page absolute inset-0" />
      <p aria-hidden="true" className="jk-display jk-studies__word">
        {/* Arabic: one merged outline (text-stroke would draw DARK's inner overlaps). */}
        {isRtl ? <OutlineText text={word} colour="rgb(var(--brand-navy) / 0.14)" className="block" /> : word}
      </p>
      <div className="jk-studies__inner">
        <div className="jk-studies__intro">
          <p className="jk-label text-jk-red">{t("studies.eyebrow")}</p>
          <h2 id="studies-title" className="jk-headline mt-5 text-[clamp(30px,2.8vw,42px)] text-jk-ink">
            <Trans k="studies.headline" tags={{ accent: (c) => <span className="block text-jk-taupe">{c}</span> }} />
          </h2>
          <p className="mt-5 max-w-[30ch] text-[15px] leading-[1.6] text-jk-muted">{t("studies.body")}</p>
        </div>
        {STUDIES.map((s, i) => (
          <figure key={s.id} className="jk-study">
            <div className="jk-study__frame">
              <img src={s.src} alt={t(`studies.item.${s.id}.alt`)} loading="lazy" decoding="async" />
            </div>
            <figcaption>
              <p className="jk-study__num">{t("studies.number", { nn: pad2(i + 1) })}</p>
              <p className="jk-study__name">{t(`studies.item.${s.id}.name`)}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
