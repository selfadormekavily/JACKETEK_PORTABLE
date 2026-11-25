import { useRef, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

type MagneticLinkProps = {
  to: string;
  children: ReactNode;
  /** "solid": filled crimson; "ghost": hairline outline. */
  tone?: "solid" | "ghost";
  className?: string;
};

/** How far the button follows the cursor (px), and its label (more). */
const PULL = 10;
const LABEL_PULL = 5;

/**
 * Call-to-action that leans toward the cursor and settles back softly,
 * with a fill that wipes up from below on hover. Mouse only — touch and
 * keyboard get the plain button. Writes transforms directly (no React
 * re-render), so it costs nothing while idle.
 */
export default function MagneticLink({
  to,
  children,
  tone = "solid",
  className = "",
}: MagneticLinkProps) {
  const button = useRef<HTMLAnchorElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  const move = (e: PointerEvent) => {
    const el = button.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    el.style.transform = `translate3d(${dx * PULL}px, ${dy * PULL * 0.6}px, 0)`;
    if (label.current)
      label.current.style.transform = `translate3d(${dx * LABEL_PULL}px, ${dy * LABEL_PULL * 0.6}px, 0)`;
  };
  const leave = () => {
    if (button.current) button.current.style.transform = "";
    if (label.current) label.current.style.transform = "";
  };

  const skin =
    tone === "solid"
      ? "bg-jk-btn text-jk-btn-text"
      : "border border-fidelio-black/25 text-fidelio-black hover:text-jk-on-ink";
  const fill = tone === "solid" ? "bg-jk-btn-hover" : "bg-fidelio-black";

  return (
    <Link
      ref={button}
      to={to}
      onPointerMove={move}
      onPointerLeave={leave}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.28em] transition-[transform,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-jk-accent ${skin} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-0 translate-y-full rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 ${fill}`}
      />
      <span
        ref={label}
        className="relative flex items-center gap-3 whitespace-nowrap transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        {children}
        <svg aria-hidden="true" width="14" height="10" viewBox="0 0 14 10" className="transition-transform duration-500 group-hover:translate-x-1">
          <path d="M0 5h12.5M8.5 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </span>
    </Link>
  );
}
