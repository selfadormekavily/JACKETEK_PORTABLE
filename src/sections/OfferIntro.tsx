import type { CSSProperties, ReactNode } from "react";
import Reveal from "@/components/Reveal";
import { revealStyle } from "@/lib/scrollTimeline";

const CONCEPTS = [
  {
    index: "01",
    title: "Colour",
    description: "Customize the jacket body and sleeve colors.",
  },
  {
    index: "02",
    title: "Embroidery",
    description: "Add your own text, graphics and artwork.",
  },
  {
    index: "03",
    title: "Fit",
    description: "Choose your preferred jacket size.",
  },
] as const;

type OfferIntroProps = {
  /**
   * true: each block is driven by the hero's scroll timeline (`--p`).
   * false: blocks reveal on their own as they scroll into view.
   */
  scrollDriven?: boolean;
  /** Render all of it, just the statement, or just the concepts. */
  show?: "all" | "statement" | "concepts";
};

/**
 * What Jacketek offers: the editorial statement plus the three
 * customisation concepts. Content only — the hero decides where it
 * sits and how it enters.
 *
 * Scroll ranges follow the hero timeline (three/heroLayout.ts): text
 * starts as the jacket is halfway through its travel (~0.45) and is
 * fully in by ~0.88.
 */
export default function OfferIntro({ scrollDriven = false, show = "all" }: OfferIntroProps) {
  const statement = show !== "concepts";
  const concepts = show !== "statement";

  return (
    <div className="flex w-full max-w-xl flex-col">
      {statement && (
        <>
          <Step scrollDriven={scrollDriven} range={[0.45, 0.6]} delayMs={0}>
            <span className="text-[11px] tracking-widest2 uppercase text-fidelio-black/40">
              Jacketek — What we do
            </span>
          </Step>

          <Step scrollDriven={scrollDriven} range={[0.48, 0.66]} delayMs={120}>
            <h2 className="mt-6 text-4xl font-light leading-[1.05] tracking-tight text-fidelio-black sm:text-5xl xl:text-6xl">
              Premium custom graduation jackets, designed around you.
            </h2>
          </Step>

          <Step scrollDriven={scrollDriven} range={[0.54, 0.72]} delayMs={240}>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-fidelio-black/60 md:text-base">
              Jacketek lets students design their own graduation jacket —
              the body and sleeve colours, the leather, the embroidery and
              every detail — then crafts it to order.
            </p>
          </Step>
        </>
      )}

      {/* Each row carries its own rules so every line fades in with
          its row (a border on the <ol> would show before the rows). */}
      {concepts && (
        <ol className={statement ? "mt-10 xl:mt-14" : ""}>
          {CONCEPTS.map((concept, i) => (
            <li key={concept.index}>
              <Step
                scrollDriven={scrollDriven}
                range={[0.62 + i * 0.06, 0.78 + i * 0.05]}
                delayMs={120 * i}
                distancePx={20}
              >
                <div
                  className={`flex items-baseline gap-4 border-b border-fidelio-black/10 py-5 sm:gap-6 ${
                    i === 0 ? "border-t" : ""
                  }`}
                >
                  <span className="w-6 shrink-0 text-xs tracking-widest2 text-fidelio-black/30">
                    {concept.index}
                  </span>
                  <h3 className="w-28 shrink-0 text-xs uppercase tracking-[0.2em] text-fidelio-black sm:w-36 sm:text-sm sm:tracking-widest2">
                    {concept.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-fidelio-black/50">
                    {concept.description}
                  </p>
                </div>
              </Step>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type StepProps = {
  scrollDriven: boolean;
  range: readonly [number, number];
  delayMs: number;
  distancePx?: number;
  children: ReactNode;
};

function Step({ scrollDriven, range, delayMs, distancePx, children }: StepProps) {
  if (!scrollDriven) return <Reveal delayMs={delayMs}>{children}</Reveal>;

  const style: CSSProperties = revealStyle(range[0], range[1], distancePx);
  return (
    <div className="will-change-[opacity,transform]" style={style}>
      {children}
    </div>
  );
}
