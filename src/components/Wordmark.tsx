type WordmarkProps = {
  className?: string;
  /** Phones: the smaller tag (20 × 25) and a 15px wordmark. */
  compact?: boolean;
  /** Just the woven "J" tag (tight bars, e.g. beside the configurator panel). */
  tagOnly?: boolean;
};

/**
 * The JACKETEK logo (design spec §9): a woven-label tag — a varsity "J"
 * with a dashed, stitched edge — beside the wordmark. Colours follow the
 * page ink (--fid-ink), so the tag inverts on the dark studio; the
 * stitching takes the world's own thread (--t-stitch: Crimson).
 */
export default function Wordmark({ className = "", compact = false, tagOnly = false }: WordmarkProps) {
  return (
    // The logo never mirrors: tag left, wordmark right, in every language.
    <span dir="ltr" className={`inline-flex items-center gap-3 ${className}`}>
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center font-varsity leading-none"
        style={{
          width: compact ? 20 : 24,
          height: compact ? 25 : 30,
          fontSize: compact ? 13 : 15,
          background: "rgb(var(--fid-ink))",
          color: "rgb(var(--fid-ink-inverse))",
          outline: "1px dashed rgb(var(--t-stitch))",
          outlineOffset: -4,
        }}
      >
        J
      </span>
      {!tagOnly && (
        <span
          className="jk-latin font-semibold uppercase leading-none"
          style={{
            fontSize: compact ? 15 : 18,
            letterSpacing: compact ? "0.3em" : "0.36em",
            color: "rgb(var(--fid-ink))",
          }}
        >
          Jacketek
        </span>
      )}
    </span>
  );
}
