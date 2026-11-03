import { isPdfMetronomeSettings, type PdfMetronomeSettings } from '../utils/pdfMetronome';
import { cloudCache, updateCloudCache } from './cloudCache';
import type { TempoChange } from '../types/tempoChange';
export const STATE_LIMITS = { annotation: 2 * 1024 * 1024, small: 64 * 1024, score: 20 * 1024 * 1024 };
export interface StateIdentity { owner: string; scoreId: string; originalHash: string; accountId: string | null; initializationError?: string }
export interface PracticeState { pdfMetronome?: PdfMetronomeSettings; bpm: number; tempoChanges: TempoChange[]; startMeasure: number; endMeasure: number; isRepeatMode: boolean }
export type PositionState = { kind: 'musicxml'; measureIndex: number; progress: number } | { kind: 'pdf'; pageIndex: number; y: number };
export interface ServerDocument { revision: number; updatedAt: string | null; schemaVersion: number; payload: unknown }
export interface Mutation { baseRevision: number; mutationId: string; schemaVersion: number; payload: unknown; generation: number }
export interface StateDocument { payload: unknown; revision: number; generation: number; dirty: boolean; serverKnown: boolean; inFlight?: Mutation; conflict?: ServerDocument; conflictOrigin?: 'tab' | 'server'; conflictCopies?: { local: unknown; server: ServerDocument }[]; error?: string }
export interface ScoreState { documents: Record<string, StateDocument>; seededFrom?: string }
export const stateStorageKey = (owner: string, scoreId: string) => `state:${JSON.stringify([owner, scoreId])}`;
export const emptyState = (): ScoreState => ({ documents: {} });
export const emptyDocument = (): StateDocument => ({ payload: null, revision: 0, generation: 0, dirty: false, serverKnown: false });
export const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export async function loadScoreState(owner: string, scoreId: string) { return await cloudCache<ScoreState>(stateStorageKey(owner, scoreId)) ?? emptyState(); }
export async function loadState(owner: string, scoreId: string, documentKey: string) { return (await loadScoreState(owner, scoreId)).documents[documentKey] ?? emptyDocument(); }
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('tempori-state') : null;
channel?.addEventListener('message', (event) => window.dispatchEvent(new CustomEvent('tempori-state-changed', { detail: event.data })));
export async function updateScoreState(owner: string, scoreId: string, change: (score: ScoreState) => ScoreState) {
  const next = await updateCloudCache<ScoreState>(stateStorageKey(owner, scoreId), (value) => change(cloneState(value ?? emptyState())));
  window.dispatchEvent(new CustomEvent('tempori-state-changed', { detail: { owner, scoreId } })); channel?.postMessage({ owner, scoreId }); return next;
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const int = (v: unknown, min: number, max: number) => num(v, min, max) && Number.isInteger(v);
export function validateStatePayload(key: string, payload: unknown, enforceSize = true): void {
  if (!/^(practice|position|annotations:(pages|wrapped|horizontal):[a-zA-Z0-9_-]{1,160})$/.test(key) || !obj(payload)) throw new Error('유효하지 않은 연습 상태입니다.');
  let valid = true;
  if (key === 'practice') {
    valid = (!('pdfMetronome' in payload) || isPdfMetronomeSettings(payload.pdfMetronome)) && num(payload.bpm, 20, 300) && int(payload.startMeasure, 1, 1000000) && int(payload.endMeasure, 1, 1000000) && Number(payload.startMeasure) <= Number(payload.endMeasure) && typeof payload.isRepeatMode === 'boolean' && Array.isArray(payload.tempoChanges) && payload.tempoChanges.length <= 2000 && payload.tempoChanges.every((t: unknown) => obj(t) && typeof t.id === 'string' && t.id.length <= 100 && int(t.startMeasure, 1, 1000000) && int(t.endMeasure, 1, 1000000) && Number(t.startMeasure) <= Number(t.endMeasure) && num(t.bpm, 20, 300) && int(t.beatsPerMeasure, 1, 16) && int(t.beatType, 1, 16));
  } else if (key === 'position') valid = payload.kind === 'musicxml' ? int(payload.measureIndex, 0, 999999) && num(payload.progress, 0, 1) : payload.kind === 'pdf' && int(payload.pageIndex, 0, 999999) && num(payload.y, 0, 1);
  else {
    const pages = key.startsWith('annotations:pages:'); const horizontal = key.startsWith('annotations:horizontal:'); let strokes = 0; let points = 0;
    const validPoints = (list: unknown) => Array.isArray(list) && list.length >= 2 && (points += list.length) <= 200000 && list.every((p: unknown) => obj(p) && num(p.x, horizontal ? -100 : 0, horizontal ? 100 : 1) && num(p.y, horizontal ? -100 : 0, horizontal ? 100 : 1));
    const validStrokes = (list: unknown) => Array.isArray(list) && list.every((s: unknown) => obj(s) && ++strokes <= 10000 && typeof s.id === 'string' && s.id.length <= 100 && ['pen', 'highlighter'].includes(String(s.tool)) && typeof s.color === 'string' && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,20}|rgba?\([0-9., %]+\))$/.test(s.color) && num(s[pages ? 'widthPageRatio' : horizontal ? 'widthStaffRatio' : 'width'], .000001, pages ? 1 : horizontal ? 10 : 100) && (horizontal ? Array.isArray(s.segments) && s.segments.every((seg: unknown) => obj(seg) && int(seg.measureIndex, 0, 999999) && validPoints(seg.points)) : validPoints(s.points)));
    const d = payload.document;
    valid = typeof payload.originalHash === 'string' && /^[a-f0-9]{64}$/.test(payload.originalHash) && typeof payload.layout === 'string' && payload.layout.length <= 1000 && obj(d) && d.version === (horizontal ? 2 : 1) && (pages ? Array.isArray(d.pages) && d.pages.length <= 10000 && d.pages.every((p: unknown) => obj(p) && int(p.pageIndex, 0, 999999) && validStrokes(p.strokes)) : validStrokes(d.strokes));
  }
  if (!valid) throw new Error('유효하지 않은 연습 상태입니다.');
  if (enforceSize && new TextEncoder().encode(JSON.stringify(payload)).length > (key.startsWith('annotations:') ? STATE_LIMITS.annotation : STATE_LIMITS.small)) throw new Error('동기화 용량을 초과했습니다. 이 기기의 내용은 유지됩니다.');
}
export async function saveLocalState(owner: string, scoreId: string, key: string, payload: unknown, expectedGeneration?: number) {
  validateStatePayload(key, payload); const copy = cloneState(payload);
  const next = await updateScoreState(owner, scoreId, (score) => {
    const current = score.documents[key] ?? emptyDocument();
    if (JSON.stringify(current.payload) === JSON.stringify(copy)) return score;
    const stale = expectedGeneration !== undefined && expectedGeneration !== current.generation;
    const localConflict = !current.conflict && stale ? { revision: current.revision, updatedAt: null, schemaVersion: 1, payload: cloneState(current.payload) } : current.conflict;
    const proposed = { ...score.documents, [key]: { ...current, payload: copy, conflict: localConflict, conflictOrigin: current.conflict ? current.conflictOrigin : stale ? 'tab' as const : undefined, conflictCopies: stale && current.conflict ? [...(current.conflictCopies ?? []), { local: cloneState(current.payload), server: cloneState(current.conflict) }] : current.conflictCopies, dirty: true, generation: current.generation + 1, error: undefined } };
    if (Object.keys(proposed).length > 512 || Object.values(proposed).reduce((size, doc) => size + new TextEncoder().encode(JSON.stringify(doc.payload)).length, 0) > STATE_LIMITS.score) throw new Error('악보 상태 용량을 초과했습니다. 이 기기의 복구 사본은 유지됩니다.');
    return { ...score, documents: proposed };
  }); return next.documents[key];
}
/** One atomic fork. Retried on saved-score open if upload/cache/state initialization partly failed. */
export async function seedScoreState(fromOwner: string, fromId: string, toOwner: string, toId: string, snapshot?: ScoreState) {
  const original = snapshot ?? await loadScoreState(fromOwner, fromId); const sourceKey = stateStorageKey(fromOwner, fromId);
  return updateScoreState(toOwner, toId, (target) => {
    if (target.seededFrom === sourceKey) return target;
    for (const [key, doc] of Object.entries(original.documents)) if (!target.documents[key] && doc.payload !== null) target.documents[key] = { ...emptyDocument(), payload: cloneState(doc.payload), dirty: true, generation: 1 };
    target.seededFrom = sourceKey; return target;
  });
}

export async function deleteScoreState(owner: string, scoreId: string) {
  await cloudCache(stateStorageKey(owner, scoreId), null);
  const identity = JSON.stringify([owner, scoreId]); const scoped = `state:[${JSON.stringify(owner)},${JSON.stringify(scoreId)},`;
  const remove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && (key.startsWith(`tempori:state-recovery:${identity}:`) || ((key.startsWith('tempori:annotations:') || key.startsWith('tempori_annotations_') || key.startsWith('tempori:horizontal-annotations:')) && key.includes(scoped)))) remove.push(key); }
  remove.forEach((key) => localStorage.removeItem(key));
}
