/**
 * A very subtle, slowly drifting smoke/cloud-like atmosphere.
 * Pure CSS (blurred, low-opacity radial gradients) — intentionally
 * cheap and lightweight rather than a Three.js/particle effect,
 * since it doesn't depend on any 3D assets.
 */
export default function SmokeAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="animate-drift-a absolute -left-1/4 top-[-10%] h-[70%] w-[70%] rounded-full opacity-[0.06] blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--brand-navy-deep) / 0.5) 0%, rgb(var(--brand-navy-deep) / 0) 70%)",
        }}
      />
      <div
        className="animate-drift-b absolute right-[-15%] top-[10%] h-[60%] w-[60%] rounded-full opacity-[0.05] blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--brand-navy-deep) / 0.45) 0%, rgb(var(--brand-navy-deep) / 0) 70%)",
        }}
      />
      <div
        className="animate-drift-a absolute bottom-[-15%] left-1/3 h-[55%] w-[55%] rounded-full opacity-[0.04] blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--brand-navy-deep) / 0.4) 0%, rgb(var(--brand-navy-deep) / 0) 70%)",
        }}
      />
    </div>
  );
}
