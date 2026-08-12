/**
 * Client-side image compression so phone photos of invoices (often 4–8 MB)
 * upload quickly on lab wifi. Uses canvas — no external dependency.
 */

export interface CompressOptions {
  /** Longest edge of the output image, in pixels. */
  maxDimension?: number;
  /** Initial JPEG quality, 0–1. Lowered automatically if the result is still too big. */
  quality?: number;
  /** Target output size in bytes; quality steps down until the result fits. */
  targetBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.75,
  targetBytes: 800 * 1024, // 800 KB
};

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  /** True when the file was left untouched (PDF, or already small enough). */
  skipped: boolean;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/**
 * Shrinks and re-encodes an image to JPEG. PDFs and already-small images pass
 * through unchanged, so callers can hand any picked file straight to this.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const { maxDimension, quality, targetBytes } = { ...DEFAULTS, ...options };
  const originalSize = file.size;

  const passthrough = (): CompressResult => ({
    file,
    originalSize,
    compressedSize: originalSize,
    skipped: true,
  });

  // Only raster images can be re-encoded; PDFs and anything else go as-is.
  if (!file.type.startsWith('image/')) return passthrough();
  // Re-encoding a small file usually makes it bigger, not smaller.
  if (originalSize <= targetBytes) return passthrough();

  try {
    const img = await loadImage(file);

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return passthrough();

    // White backdrop so transparent PNGs don't turn black once flattened to JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let q = quality;
    let blob = await canvasToBlob(canvas, q);

    // Step the quality down until it fits, but never below a legible floor.
    while (blob && blob.size > targetBytes && q > 0.4) {
      q -= 0.1;
      blob = await canvasToBlob(canvas, q);
    }

    if (!blob || blob.size >= originalSize) return passthrough();

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return {
      file: new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() }),
      originalSize,
      compressedSize: blob.size,
      skipped: false,
    };
  } catch {
    // A failed compression should never block the upload.
    return passthrough();
  }
}
