import { Link } from "react-router-dom";
import Reveal from "@/components/Reveal";
import { ROUTES } from "@/lib/routes";

/**
 * Call to action that follows the hero/offer sequence: large display
 * headline, short supporting copy and two CTAs. (The 01/02/03
 * concepts live in OfferIntro.) Every block fades/slides in via
 * Reveal as it scrolls into view.
 *
 * "Start Designing" opens the configurator; "How It Works" is still a
 * placeholder anchor until that content exists.
 */
export default function Customize() {
  return (
    <section className="relative flex w-full flex-col items-center bg-fidelio-white px-6 py-24 md:py-36">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <Reveal>
          <span className="text-[11px] tracking-widest2 uppercase text-fidelio-black/40">
            The Jacketek Experience
          </span>
        </Reveal>

        <Reveal delayMs={120}>
          <h2 className="mt-6 text-4xl font-light leading-[1.05] tracking-tight text-fidelio-black sm:text-6xl md:text-7xl">
            Designed by you.
            <br />
            Crafted by Jacketek.
          </h2>
        </Reveal>

        <Reveal delayMs={240}>
          <p className="mt-8 max-w-xl text-sm leading-relaxed text-fidelio-black/60 md:text-base">
            Every Jacketek jacket starts as a blank canvas. Choose your
            colourway, place your embroidery, and dial in your fit — then
            watch it come together in real time.
          </p>
        </Reveal>

        <Reveal delayMs={360} className="mt-12">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <Link
              to={ROUTES.design}
              className="bg-fidelio-black px-10 py-4 text-[11px] tracking-widest2 uppercase text-fidelio-white transition-opacity duration-300 hover:opacity-80"
            >
              Start Designing
            </Link>
            <a
              href="#"
              className="border border-fidelio-black/20 px-10 py-4 text-[11px] tracking-widest2 uppercase text-fidelio-black transition-colors duration-300 hover:border-fidelio-black"
            >
              How It Works
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
