import { vevenoApi } from '../../api/vevenoApi';
import { resizeImageForUpload } from '../../lib/resizeImageForUpload';
import { isVevenoDemoRequest } from './vevenoDemo';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('이미지를 읽지 못했습니다.'));
    };
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export async function resolveUploadedImage(
  storeId: string,
  kind: 'menu' | 'recipe' | 'stock',
  file: File | null,
  cleared: boolean,
): Promise<string | undefined> {
  if (file) {
    const resized = await resizeImageForUpload(file);
    if (isVevenoDemoRequest()) {
      return fileToDataUrl(resized);
    }
    const { data } = await vevenoApi.uploadImage(storeId, kind, resized);
    return data.url;
  }
  if (cleared) {
    return '';
  }
  return undefined;
}
