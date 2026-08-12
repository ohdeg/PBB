const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

/**
 * Browser-side resize before R2 upload — long edge capped, JPEG output.
 */
export async function resizeImageForUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('캔버스를 사용할 수 없습니다.');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('이미지 압축에 실패했습니다.'));
          }
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
