import type { CSSProperties, ReactNode } from "react";
import { FRAME_H, FRAME_W } from "@/sections/frame";

/**
 * A 1440 × 900 artboard, scaled by --u and centred in its (full-bleed)
 * parent. Children are positioned in the design's pixels.
 */
export default function DesignFrame({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`jk-frame pointer-events-none absolute left-1/2 top-1/2 ${className}`}
      style={{
        width: FRAME_W,
        height: FRAME_H,
        transform: "translate(-50%, -50%) scale(var(--u, 1))",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
