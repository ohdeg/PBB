import { blobToMusicXml } from './temporiLoader';
import { AppError } from './appError';

export interface TemporiFileMetadata {
  title: string;
  artist: string | null;
}

const ALLOWED_EXTENSIONS = ['.musicxml', '.mxl'] as const;

const TEMPORI_FILE_ACCEPT_DESKTOP =
  '.musicxml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml';

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

export function getTemporiFileInputAccept(): string | undefined {
  // iOS Safari may disable MXL files even with XML/ZIP MIME types in accept.
  // Omit the picker filter; extractTemporiMetadataFromFile still validates the
  // extension and content before a file can be saved.
  return isIosFilePicker() ? undefined : TEMPORI_FILE_ACCEPT_DESKTOP;
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

export function assertAllowedTemporiFile(file: File): void {
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new AppError('errors.invalidTemporiFileType');
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

export function parseMusicXmlMetadata(xml: string, fileName: string): TemporiFileMetadata {
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

export async function extractTemporiMetadataFromFile(file: File): Promise<TemporiFileMetadata> {
  assertAllowedTemporiFile(file);
  const xml = await blobToMusicXml(file);
  return parseMusicXmlMetadata(xml, file.name);
}
