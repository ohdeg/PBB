import type { AxiosResponse } from 'axios';
import { apiClient } from '../../../api/axios';
import { captureCloudSession } from './temporiCloudApi';
import type { Mutation, ServerDocument } from './temporiStateRepository';
export interface StateSummary { documentKey: string; revision: number; schemaVersion: number; updatedAt: string }
function session(account: string) { const s = captureCloudSession(); if (s.account !== account) throw new DOMException('Account changed', 'AbortError'); return s; }
const url = (score: string, key?: string) => `/api/v1/tempori/${encodeURIComponent(score)}/state${key ? `/${encodeURIComponent(key)}` : ''}`;
export async function stateRevisions(account: string, score: string): Promise<StateSummary[]> {
  const s = session(account); let cursor: string | null = null; const result: StateSummary[] = [];
  do { const response: AxiosResponse<{ items: StateSummary[]; nextCursor: string | null }> = await apiClient.get<{ items: StateSummary[]; nextCursor: string | null }>(url(score), { signal: s.signal, params: cursor ? { cursor } : {} }); s.assert(); result.push(...response.data.items); cursor = response.data.nextCursor; } while (cursor);
  return result;
}
export async function getStateDocument(account: string, score: string, key: string) { const s = session(account); const { data } = await apiClient.get<ServerDocument>(url(score, key), { signal: s.signal }); s.assert(); return data; }
export async function putStateDocument(account: string, score: string, key: string, mutation: Mutation) {
  const s = session(account); const { generation: _generation, ...body } = mutation;
  try { const { data } = await apiClient.put<ServerDocument>(url(score, key), body, { signal: s.signal }); s.assert(); return data; }
  catch (error) { s.assert(); throw error; }
}
export function conflictDocument(error: unknown): ServerDocument | null {
  const e = error as { response?: { status?: number; data?: ServerDocument } };
  const d = e.response?.data; return e.response?.status === 409 && d && Number.isInteger(d.revision) ? d : null;
}
