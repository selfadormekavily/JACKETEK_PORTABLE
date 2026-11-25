import type { ReactNode } from "react";

type AtmosphereProps = {
  className?: string;
  /** Extra layers painted above the room and below the grain (e.g. the jacket's glow). */
  children?: ReactNode;
};

/**
 * The cream room: the environment the jacket hangs in, painted in layers
 * (styles/index.css, `.jk-atmos`). The world's gradient as the base; a soft
 * window light from the upper left; a slowly drifting dusty-blue ambient
 * behind the subject; a faint pinstripe wall; a floor plane with its
 * horizon seam; a vignette; textile grain on top. Every light-room layer
 * fades out on a dark world (--jk-dark), and their strengths follow the
 * homepage chapters (--jk-amb, --jk-wall). Purely decorative.
 */
export default function Atmosphere({ className = "", children }: AtmosphereProps) {
  return (
    <div aria-hidden="true" className={`jk-atmos ${className}`}>
      <div className="jk-atmos__window" />
      <div className="jk-atmos__wall" />
      <div className="jk-atmos__ambient" />
      <div className="jk-atmos__floor" />
      {children}
      <div className="jk-atmos__vignette" />
      <div className="jk-grain jk-atmos__grain" />
    </div>
  );
}
