/**
 * Re-dyes the pre-rendered silver embroidery (the JACKETEK wordmark, the
 * "Stitched" lettering) in a brand colour: each pixel's luminance times
 * the colour, so the thread's sheen, shading and shadows stay as they
 * are, and the thread's mean tone lands exactly on the colour.
 *
 * Mounted once at the app root; elements use `filter: url(#id)` via
 * CRIMSON_THREAD / CREAM_THREAD / NAVY_THREAD (brand palette).
 */

/** Mean luminance of the silver thread in the embroidery images. */
const SILVER_MEAN = 0.56;

const DYES = {
  "jk-crimson-thread": [0xc1, 0x12, 0x1f],
  "jk-cream-thread": [0xfc, 0xf0, 0xd6],
  "jk-navy-thread": [0x00, 0x30, 0x49],
} as const;

export const CRIMSON_THREAD = "url(#jk-crimson-thread)";
export const CREAM_THREAD = "url(#jk-cream-thread)";
export const NAVY_THREAD = "url(#jk-navy-thread)";

const row = (gain: number) => `${(0.2126 * gain).toFixed(4)} ${(0.7152 * gain).toFixed(4)} ${(0.0722 * gain).toFixed(4)} 0 0`;

export default function ThreadDyes() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      {Object.entries(DYES).map(([id, colour]) => (
        <filter key={id} id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={`${colour.map((c) => row(c / 255 / SILVER_MEAN)).join(" ")} 0 0 0 1 0`} />
        </filter>
      ))}
    </svg>
  );
}
