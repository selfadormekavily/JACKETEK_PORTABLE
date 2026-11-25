import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import { useDocumentTitle } from "@/i18n/useI18n";
import Hero from "@/sections/Hero";
import MaterialStudies from "@/sections/MaterialStudies";

/**
 * Homepage: the pinned 3D story (hero → idea → jacket → craft →
 * embroidery → make it yours → call to action), then the footer.
 *
 * On larger screens the footer waits underneath: the story lifts away
 * like a curtain to uncover it, instead of a new section starting.
 */
export default function LandingPage() {
  useDocumentTitle("meta.title.default");
  return (
    <>
      <Nav />
      <main className="relative z-10 shadow-[0_40px_80px_-30px_rgb(var(--brand-navy-deep)/0.55)]">
        <Hero />
        <MaterialStudies />
      </main>
      <SiteFooter className="relative z-0 md:sticky md:bottom-0" />
    </>
  );
}
