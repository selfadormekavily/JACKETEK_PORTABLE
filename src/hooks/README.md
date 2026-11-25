# hooks/

Shared custom React hooks.

- `useInView.ts` — IntersectionObserver-based hook powering
  scroll-triggered reveal animations (used by `components/Reveal.tsx`).
- `useScrollProgress.ts` — eased 0→1 progress through a tall element,
  written to the `--p` CSS variable for pinned scroll sequences.
- `useMediaQuery.ts` — live boolean for a CSS media query.
