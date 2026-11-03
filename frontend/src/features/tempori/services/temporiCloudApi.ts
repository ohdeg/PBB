import type { AxiosResponse } from 'axios';
import { apiClient as api } from '../../../api/axios';
import { useAuthStore } from '../../../stores/authStore';
import { createAccountSession } from './cloudSession';
import type { TemporiSummary } from '../types';
import { downloadError, downloadStep } from './temporiDownloadError';

export interface CloudScore extends TemporiSummary { format: 'pdf' | 'musicxml' | 'mxl'; sizeBytes: number; sha256: string; version: number }
const session = createAccountSession(useAuthStore.getState().userId);
useAuthStore.subscribe((state) => session.setAccount(state.userId));
export const captureCloudSession = () => session.capture();
export const currentAccount = () => useAuthStore.getState().userId;
export async function listCloudScores(): Promise<CloudScore[]> {
  const request = session.capture(); const result: CloudScore[] = []; let cursor: string | null = null;
  do {
    const response: AxiosResponse<{ items: CloudScore[]; nextCursor: string | null }> = await api.get<{ items: CloudScore[]; nextCursor: string | null }>('/api/v1/tempori', { params: cursor ? { cursor } : {}, signal: request.signal });
    request.assert(); result.push(...response.data.items); cursor = response.data.nextCursor;
  } while (cursor);
  return result;
}
export async function cloudScoreDetail(id: string): Promise<CloudScore> {
  const request = session.capture();
  const { data } = await api.get<CloudScore>(`/api/v1/tempori/${encodeURIComponent(id)}`, { signal: request.signal }); request.assert(); return data;
}
export async function uploadCloudScore(file: File, title: string, artist: string | undefined, key: string): Promise<CloudScore> {
  const request = session.capture(); const body = new FormData(); body.append('file', file); body.append('title', title); if (artist) body.append('artist', artist);
  const { data } = await api.post<CloudScore>('/api/v1/tempori', body, { headers: { 'Idempotency-Key': key }, signal: request.signal }); request.assert(); return data;
}
export async function deleteCloudScore(id: string): Promise<void> {
  const request = session.capture(); await api.delete(`/api/v1/tempori/${encodeURIComponent(id)}`, { signal: request.signal }); request.assert();
}
export async function downloadCloudScore(id: string): Promise<Blob> {
  const request = session.capture();
  try {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data } = await downloadStep('DOWNLOAD-URL', () => api.post<{ url: string; expiresAt: string }>(`/api/v1/tempori/${encodeURIComponent(id)}/download-url`, {}, { signal: request.signal })); request.assert();
    const response = await downloadStep('OBJECT-FETCH', () => fetch(data.url, { signal: request.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }));
    request.assert();
    if (response.ok) { const blob = await downloadStep('OBJECT-BODY', () => response.blob()); request.assert(); return blob; }
    if (attempt === 0 && (response.status === 401 || response.status === 403)) continue;
    throw downloadError('OBJECT-FETCH', { response: { status: response.status } });
  }
  throw downloadError('DOWNLOAD-URL', null);
  } catch (failure) { request.assert(); throw failure; }
}
export async function scoreHash(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
