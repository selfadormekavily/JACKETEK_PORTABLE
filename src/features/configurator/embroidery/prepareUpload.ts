import type { EmbroideryImage } from "../model/types";
import { backgroundRemover, type CutoutQuality } from "./backgroundRemoval";

/** Longest side uploads are processed at (plenty for stitching). */
const WORKING_PX = 768;
const ACCEPTED = /^image\/(png|jpeg|webp|gif|bmp|svg\+xml)$/;
const MAX_BYTES = 15 * 1024 * 1024;

export type PreparedUpload = { image: EmbroideryImage; quality: CutoutQuality };

/**
 * Why an upload was refused, as a code the UI turns into a message in the
 * current language (configurator.upload.errors.<code>). Any other error
 * (decode failures, browser DOMExceptions) is shown as "unreadable".
 */
export type UploadErrorCode = "unreadable" | "type" | "tooLarge";

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  constructor(code: UploadErrorCode, message: string) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
}

/** The file's exact bytes as a data URL. */
function readDataUrl(file: File): Promise<string> {
  return new Promise((ok, fail) => {
    const reader = new FileReader();
    reader.onload = () => ok(reader.result as string);
    reader.onerror = () => fail(reader.error ?? new UploadError("unreadable", "That image couldn't be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload → isolated design ready for embroidery: decode, downscale,
 * remove the background, trim, and store as a transparent PNG.
 * (The conversion to stitches happens at render time, from this PNG.)
 * The uploaded file itself is kept alongside, unchanged, for production.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (!ACCEPTED.test(file.type)) throw new UploadError("type", "Please upload a PNG, JPG, WebP or SVG image.");
  if (file.size > MAX_BYTES) throw new UploadError("tooLarge", "That image is too large (max 15 MB).");

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const original = {
      src: await readDataUrl(file),
      fileName: file.name,
      mimeType: file.type,
      widthPx: img.naturalWidth || null,
      heightPx: img.naturalHeight || null,
    };
    const w = img.naturalWidth || img.width || WORKING_PX;
    const h = img.naturalHeight || img.height || WORKING_PX;
    const s = Math.min(1, WORKING_PX / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    canvas.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, canvas.width, canvas.height);

    const { canvas: cutout, quality } = await backgroundRemover.remove(canvas);
    return {
      image: {
        src: cutout.toDataURL("image/png"),
        aspect: cutout.width / cutout.height,
        processed: { widthPx: cutout.width, heightPx: cutout.height },
        original,
      },
      quality,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
