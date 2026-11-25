import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The JACKETEK colour system. Palette values live once, as CSS
        // variables in styles/index.css (--brand-*); every role token reads
        // the current colour world (--t-*, rewritten by the homepage as it
        // scrolls — three/heroLayout MOODS).
        jk: {
          // Brand palette, for fixed uses.
          navy: "rgb(var(--brand-navy) / <alpha-value>)",
          cream: "rgb(var(--brand-cream) / <alpha-value>)",
          crimson: "rgb(var(--brand-crimson) / <alpha-value>)",
          oxblood: "rgb(var(--brand-oxblood) / <alpha-value>)",
          red: "rgb(var(--brand-red) / <alpha-value>)",
          dusty: "rgb(var(--brand-dusty) / <alpha-value>)",
          "navy-soft": "rgb(var(--brand-navy-soft) / <alpha-value>)",
          "navy-deep": "rgb(var(--brand-navy-deep) / <alpha-value>)",

          // Surfaces.
          paper: "rgb(var(--brand-cream) / <alpha-value>)",
          canvas: "rgb(var(--brand-cream-deep) / <alpha-value>)",
          raised: "rgb(var(--brand-cream-raised) / <alpha-value>)",
          "studio-center": "rgb(var(--brand-cream-raised) / <alpha-value>)",
          "studio-mid": "rgb(var(--brand-cream-deep) / <alpha-value>)",

          // Type and detail roles (follow the colour world).
          ink: "rgb(var(--t-head) / <alpha-value>)",
          "on-dark": "rgb(var(--t-head) / <alpha-value>)",
          body: "rgb(var(--t-body) / <alpha-value>)",
          muted: "rgb(var(--t-muted) / <alpha-value>)",
          numeral: "rgb(var(--t-numeral) / <alpha-value>)",
          "muted-dark": "rgb(var(--t-muted) / <alpha-value>)",
          taupe: "rgb(var(--t-accent) / <alpha-value>)",
          "taupe-dark": "rgb(var(--t-accent) / <alpha-value>)",
          accent: "rgb(var(--t-link) / <alpha-value>)",
          "on-ink": "rgb(var(--t-on-head) / <alpha-value>)",
          rule: "rgb(var(--t-rule) / <alpha-value>)",
          "hover-ink": "rgb(var(--t-head) / <alpha-value>)",
          // Primary action.
          btn: "rgb(var(--t-btn) / <alpha-value>)",
          "btn-text": "rgb(var(--t-btn-text) / <alpha-value>)",
          "btn-hover": "rgb(var(--t-btn-hover) / <alpha-value>)",
        },
        fidelio: {
          // Ink. A variable so the homepage story can flip it light in its
          // dark chapters; elsewhere it's always navy.
          black: "rgb(var(--fid-ink) / <alpha-value>)",
          // Legacy names, mapped onto the JACKETEK palette.
          white: "rgb(var(--brand-cream-deep) / <alpha-value>)",
          gray: "rgb(var(--t-muted) / <alpha-value>)",
          ivory: "rgb(var(--brand-cream) / <alpha-value>)",
          ink: "rgb(var(--brand-navy) / <alpha-value>)",
          stone: "rgb(var(--t-accent) / <alpha-value>)",
          gold: "rgb(var(--t-link) / <alpha-value>)",
          espresso: "rgb(var(--brand-oxblood) / <alpha-value>)",
          sand: "rgb(var(--brand-cream-deep) / <alpha-value>)",
        },
      },
      fontFamily: {
        // The stacks live in CSS variables (styles/index.css, i18n.css) so the
        // Arabic locale can swap in its own faces without touching components.
        sans: ["var(--font-sans)"],
        /** Giant editorial display words (DETAIL, MOMENT). */
        display: ["var(--font-display)"],
        /** Varsity lettering (the logo tag's "J"). */
        varsity: ["Graduate", "Alfa Slab One", "Rockwell", "serif"],
      },
      letterSpacing: {
        widest2: "0.35em",
      },
      transitionProperty: {
        // Text colour never fades: type is always exactly one palette colour,
        // never a blend between two (grounds, borders and
        // fills still transition).
        colors: "background-color, border-color, text-decoration-color, fill, stroke",
      },
    },
  },
  plugins: [
    // `cfg:` — the configurator's split layout (stage | panel): desktops, and
    // tablets held landscape; below it the preview is pinned above the
    // controls. A variant, not a screen: a raw screen would switch off every
    // max-* variant. (Keep in step with styles/configurator-flow.css.)
    plugin(({ addVariant }) => {
      addVariant("cfg", "@media (min-width: 1180px), (min-width: 1024px) and (orientation: landscape)");
    }),
  ],
} satisfies Config;
