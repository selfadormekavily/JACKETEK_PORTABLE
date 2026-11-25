# sections/

Larger page sections composed from components/.

- `Hero.tsx` — the homepage story: ONE pinned (1300vh), scroll-driven 3D
  scene (`three/scene/FidelioScene`). A camera films the jacket through
  six chapters — idea, jacket, craft, embroidery, make it yours, final
  call to action. Shots, timeline and anchors live in
  `three/heroLayout.ts`; driven by `hooks/useScrollProgress` +
  `lib/scrollTimeline`. Reduced motion only disables the idle life
  (breathing, drift, cursor response) — scroll still drives the story.
- `HeroStory.tsx` — the words told around the jacket: tracking-in
  labels, masked line reveals, blur-to-sharp copy, and product
  annotations pinned to points on the real garment (positions projected
  from the 3D scene as CSS variables). Portrait screens get a compact
  version below the jacket.
- `OfferIntro.tsx`, `Customize.tsx` — superseded by the story; no longer
  used (kept until deleted).
