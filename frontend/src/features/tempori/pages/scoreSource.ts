import { blobToMusicXml } from '../utils/temporiLoader';
import type { ScoreSource } from './types';
export async function sourceFromBlob(id: string, blob: Blob): Promise<ScoreSource> {
  if (blob.size > 25 * 1024 * 1024) throw new Error('악보 원본은 25 MiB 이하여야 합니다.');
  const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) === '%PDF-') return { kind: 'pdf', id, blob };
  return { kind: 'musicxml', id, xml: await blobToMusicXml(blob) };
}
export async function loadScoreSource(id: string): Promise<ScoreSource> {
  const { fetchTemporiContent } = await import('../services/temporiRepository');
  return sourceFromBlob(id, await fetchTemporiContent(id));
}
