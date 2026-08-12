/** Transparent-padding normalize for closet garment PNGs. */

export const GARMENT_PAD_FRACTION = 0.08;
export const GARMENT_MIN_PAD_PX = 8;

export interface AlphaBBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Opaque (alpha > threshold) bounding box, or null if fully transparent. */
export function findOpaqueBBox(
  imageData: ImageData,
  alphaThreshold = 8,
): AlphaBBox | null {
  const { data, width, height } = imageData;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const a = data[row + x * 4 + 3];
      if (a > alphaThreshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) {
    return null;
  }
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

function drawSourceToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스를 사용할 수 없습니다.');
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/**
 * Crop to opaque content, then add ~8% transparent padding (matches ML garment extract).
 */
export function normalizeGarmentCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  padFraction: number = GARMENT_PAD_FRACTION,
): HTMLCanvasElement {
  const full = drawSourceToCanvas(source, sourceWidth, sourceHeight);
  const ctx = full.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스를 사용할 수 없습니다.');
  }
  const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const bbox = findOpaqueBBox(imageData);
  if (!bbox) {
    return full;
  }
  const contentW = bbox.right - bbox.left;
  const contentH = bbox.bottom - bbox.top;
  const padX = Math.max(
    GARMENT_MIN_PAD_PX,
    Math.round(contentW * padFraction),
  );
  const padY = Math.max(
    GARMENT_MIN_PAD_PX,
    Math.round(contentH * padFraction),
  );
  const out = document.createElement('canvas');
  out.width = contentW + padX * 2;
  out.height = contentH + padY * 2;
  const outCtx = out.getContext('2d');
  if (!outCtx) {
    throw new Error('캔버스를 사용할 수 없습니다.');
  }
  outCtx.clearRect(0, 0, out.width, out.height);
  outCtx.drawImage(
    full,
    bbox.left,
    bbox.top,
    contentW,
    contentH,
    padX,
    padY,
    contentW,
    contentH,
  );
  return out;
}

export function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
    img.src = url;
  });
}

export async function normalizeGarmentFromUrl(
  url: string,
): Promise<HTMLCanvasElement> {
  const img = await loadHtmlImage(url);
  return normalizeGarmentCanvas(img, img.naturalWidth, img.naturalHeight);
}

export async function normalizeGarmentPngFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const normalized = normalizeGarmentCanvas(
      bitmap,
      bitmap.width,
      bitmap.height,
    );
    const blob = await new Promise<Blob | null>((resolve) => {
      normalized.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) {
      throw new Error('이미지 정규화에 실패했습니다.');
    }
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.png', {
      type: 'image/png',
    });
  } finally {
    bitmap.close();
  }
}
