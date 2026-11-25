/**
 * English source: story — the homepage's scroll story, beats 01–05
 * (sections/HeroStory.tsx).
 *
 * Headlines are rich text, one tag per line, so translators keep the
 * design's line breaks and two-colour split:
 *   <l1>…</l1> <l2>…</l2> <l3>…</l3>  a line in the headline colour
 *   <a1>…</a1> <a2>…</a2> <a3>…</a3>  a line in the accent colour
 * The number is the line's place in the entrance (1 rises first).
 */
const story = {
  /** Giant words behind the jacket (aria-hidden). */
  backdrop: {
    detail: "Detail",
    moment: "Moment",
  },
  /** "[ 02 / 05 ]" */
  counter: "[ {n} / {total} ]",
  idea: {
    eyebrow: "The idea",
    headline: "<l1>Designed for</l1> <a2>your year.</a2>",
    /** <em>: the highlighted phrase. */
    body: "Graduation is <em>a moment worth keeping</em>. Jacketek creates custom jackets designed around the people, memories and identity of each class.",
    cta: "Discover the craft",
    spec: {
      wool: "Cotton fabric body",
      leather: "Leather sleeves",
      rib: "Rib knit trim",
      made: "Made to order",
    },
  },
  jacket: {
    eyebrow: "The jacket",
    headline: "<l1>Every detail,</l1> <a2>considered.</a2>",
    callout: {
      wool: { title: "Cotton fabric body", detail: "Dense, soft cotton fabric with a matte finish." },
      leather: { title: "Leather sleeves", detail: "Supple leather that softens with wear." },
      fit: { title: "Baggy fit", detail: "One roomy, relaxed cut, in your size." },
      built: { title: "Built to last", detail: "Rib knit trims and pressed snaps." },
    },
    footer: "Cotton fabric · Leather · Rib knit · Pressed snaps",
    /** Phones: the callouts as a list. */
    compact: {
      wool: { term: "Cotton fabric body", value: "Dense, soft cotton" },
      leather: { term: "Leather sleeves", value: "Softens with wear" },
      fit: { term: "Baggy fit", value: "Roomy, in your size" },
      built: { term: "Built to last", value: "Rib knit, pressed snaps" },
    },
  },
  craft: {
    eyebrow: "The craft",
    headline: "<l1>Made to be</l1> <a2>kept.</a2>",
    body: "Rib-knit collar and cuffs, pressed snaps, clean-finished seams — every part chosen to outlast graduation day.",
    spec: {
      collar: "Rib-knit collar and cuffs",
      snaps: "Pressed snaps",
      seams: "Clean-finished seams",
    },
    /** Tags pinned to the live macro shot. */
    tag: {
      collar: "Rib-knit collar",
      snap: "Pressed snap",
      sleeve: "Leather sleeve",
    },
    figCaption: "Fig. 03 — Macro",
  },
  stitch: {
    sideLabel: "Back view — Fig. 04",
    macro: "Macro",
    raised: "Raised thread",
    threadByThread: "Thread by thread.",
    eyebrow: "Embroidery",
    /**
     * The embroidered word of the headline. English shows the satin-stitch
     * artwork (this is its alt text); other languages render this word as
     * live embroidered text (components/StitchedText).
     */
    stitched: "Stitched",
    /** Text set right after the embroidered word (English: its comma). */
    afterStitched: ",",
    notPrinted: "not printed.",
    body: "Names, years and crests are embroidered thread by thread — raised, textured, and placed exactly where you want them.",
    bodyCompact: "Names, years and crests, embroidered thread by thread — placed exactly where you want them.",
    spec: {
      name: "Your name",
      year: "Your year",
      crest: "Your crest",
    },
  },
  finale: {
    eyebrow: "Yours",
    /**
     * Wide screens split the sentence across the jacket: `lead` stands on
     * the reading-start side, `rest` (with the copy and the button) on the
     * other.
     */
    lead: "Made for",
    rest: "<l2>your</l2> <a3>moment.</a3>",
    /** Phones: the whole headline in one place. */
    headlineCompact: "<l1>Made for</l1> <a2>your moment.</a2>",
    body: "Create a jacket that is uniquely yours.",
    cta: "Design your jacket",
    viewCraft: "View the craft",
    footer: "Made to order — Class of 2027",
  },
};

export default story;
