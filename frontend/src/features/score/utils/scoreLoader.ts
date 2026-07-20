import { fetchScoreContent } from '../services/scoreRepository';
import { AppError } from './appError';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isZipBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function isMusicXmlText(text: string): boolean {
  const normalized = stripBom(text).trim();
  return (
    normalized.startsWith('<?xml') ||
    normalized.includes('<score-partwise') ||
    normalized.includes('<score-timewise')
  );
}

async function extractMusicXmlFromMxl(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');

  if (containerXml) {
    const match = containerXml.match(/full-path="([^"]+)"/i);
    if (match?.[1]) {
      const rootXml = await zip.file(match[1])?.async('string');
      if (rootXml) {
        return rootXml;
      }
    }
  }

  const xmlEntry = Object.keys(zip.files).find(
    (name) => (name.endsWith('.xml') || name.endsWith('.musicxml')) && !name.startsWith('META-INF/'),
  );
  if (xmlEntry) {
    const xml = await zip.file(xmlEntry)?.async('string');
    if (xml) {
      return xml;
    }
  }

  throw new AppError('errors.mxlNoMusicXml');
}

export async function blobToMusicXml(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const xmlText = isZipBuffer(bytes)
    ? await extractMusicXmlFromMxl(buffer)
    : stripBom(new TextDecoder('utf-8').decode(buffer)).trim();

  if (!isMusicXmlText(xmlText)) {
    throw new AppError('errors.invalidMusicXmlContent');
  }

  return xmlText;
}

export async function fetchScoreMusicXml(scoreId: string): Promise<string> {
  const blob = await fetchScoreContent(scoreId);
  return blobToMusicXml(blob);
}
