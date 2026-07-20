import { blobToMusicXml } from './scoreLoader';
import { AppError } from './appError';

export interface ScoreFileMetadata {
  title: string;
  artist: string | null;
}

const ALLOWED_EXTENSIONS = ['.musicxml', '.mxl'] as const;

const SCORE_FILE_ACCEPT_DESKTOP =
  '.musicxml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml';

/**
 * iOS WKWebView는 Recordare 전용 MIME으로는 MXL/MusicXML이 비활성화된다.
 * xml·zip 계열 UTType으로 완화하면 악보 파일은 선택 가능하고, PDF·이미지 등은 대부분 걸러진다.
 * 그래도 다른 .xml/.zip이 보일 수 있어 선택 직후 확장자 검증은 필수다.
 */
const SCORE_FILE_ACCEPT_IOS =
  '.musicxml,.mxl,application/xml,text/xml,application/zip,application/x-zip-compressed';

function isIosFilePicker(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function getScoreFileInputAccept(): string {
  return isIosFilePicker() ? SCORE_FILE_ACCEPT_IOS : SCORE_FILE_ACCEPT_DESKTOP;
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

export function assertAllowedScoreFile(file: File): void {
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new AppError('errors.invalidScoreFileType');
  }
}

function fallbackTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function readCreator(doc: Document, ...types: string[]): string | null {
  const normalizedTypes = new Set(types.map((type) => type.toLowerCase()));
  const creators = Array.from(doc.querySelectorAll('identification creator, creator'));

  for (const creator of creators) {
    const type = creator.getAttribute('type')?.toLowerCase() ?? '';
    if (normalizedTypes.has(type)) {
      const value = creator.textContent?.trim();
      if (value) {
        return value;
      }
    }
  }

  return null;
}

export function parseMusicXmlMetadata(xml: string, fileName: string): ScoreFileMetadata {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new AppError('errors.musicXmlMetadataParseFailed');
  }

  const workTitle = document.querySelector('work-title')?.textContent?.trim();
  const movementTitle = document.querySelector('movement-title')?.textContent?.trim();
  const composer =
    readCreator(document, 'composer', 'arranger') ??
    readCreator(document, 'lyricist') ??
    null;

  const title = workTitle || movementTitle || fallbackTitleFromFileName(fileName);

  return {
    title,
    artist: composer,
  };
}

export async function extractScoreMetadataFromFile(file: File): Promise<ScoreFileMetadata> {
  assertAllowedScoreFile(file);
  const xml = await blobToMusicXml(file);
  return parseMusicXmlMetadata(xml, file.name);
}
