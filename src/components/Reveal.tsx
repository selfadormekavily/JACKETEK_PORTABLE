import type { ReactNode } from "react";
import { useInView } from "@/hooks/useInView";

type RevealProps = {
  children: ReactNode;
  delayMs?: number;
  className?: string;
};

/**
 * Fades + slides its children up into place the first time they
 * scroll into view. Wrap any block of section content in this to get
 * a consistent scroll-reveal animation across the site.
 */
export default function Reveal({
  children,
  delayMs = 0,
  className = "",
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
