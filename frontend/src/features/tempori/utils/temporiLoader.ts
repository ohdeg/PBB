import { fetchTemporiContent } from '../services/temporiRepository';
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
  if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text)) return false;
  const document = new DOMParser().parseFromString(text, 'application/xml');
  return !document.querySelector('parsererror') && ['score-partwise', 'score-timewise'].includes(document.documentElement.localName);
}

async function extractMusicXmlFromMxl(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > 1000) throw new Error('압축 파일 항목이 너무 많습니다.');
  let total = 0;
  for (const entry of entries) {
    const metadata = entry as typeof entry & { unsafeOriginalName?: string; _data?: { uncompressedSize?: number } };
    const path = metadata.unsafeOriginalName ?? entry.name;
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..') || /^[A-Za-z]:/.test(path)) throw new Error('잘못된 압축 경로입니다.');
    total += metadata._data?.uncompressedSize ?? 0;
    if (total > 100 * 1024 * 1024) throw new Error('압축 해제 용량 제한을 초과했습니다.');
  }
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
  if (blob.size > 25 * 1024 * 1024) throw new Error('악보 원본은 25 MiB 이하여야 합니다.');
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

export async function fetchTemporiMusicXml(temporiId: string): Promise<string> {
  const blob = await fetchTemporiContent(temporiId);
  return blobToMusicXml(blob);
}
