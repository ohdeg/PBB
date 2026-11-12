import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/axios';

type Failure = { app: string; operation: string; status: number; count: number; lastMs: number; requestId: string };
type Change = { id: string; atMs: number; actor: string; target: string; action: string; before: string; after: string };
type Today = { date: string; errors: Failure[]; changes: Change[]; nextCursor: string | null };

const clock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const apps = ['PBB', 'Veveno', 'Tempori', 'Sranko', '6pick', 'Dieta'];

export function OperationsPanel() {
  const [data, setData] = useState<Today | null>(null);
  const [selected, select] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async function fetchPage(cursor?: string, expectedDate?: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(false);
    try {
      const { data: page } = await apiClient.get<Today>('/api/v1/dev/operations/today', {
        params: cursor ? { cursor } : {}, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (cursor && expectedDate !== page.date) {
        void fetchPage();
        return;
      }
      setData(prev => cursor && prev ? { ...page, changes: [...prev.changes, ...page.changes] } : page);
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
        setData(null);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  const errors = data?.errors.filter(e => !selected || e.app === selected) ?? [];
  return <section className="profile-dev-card ops-panel" aria-labelledby="ops-title">
    <div className="ops-toolbar">
      <h2 id="ops-title">오늘의 운영 기록</h2>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void load()}>새로고침</button>
    </div>
    <p className="profile-lead">{data ? data.date + ' · ' : ''}한국 시간 기준 · 앱 API에서 발생한 서버 오류(5xx)</p>
    {error && <p role="alert">운영 기록을 불러오지 못했습니다. 새로고침으로 다시 시도하세요.</p>}
    {busy && <p role="status">운영 기록을 불러오는 중입니다.</p>}
    {data && <>
      <div className="ops-toolbar">
        <h3>앱별 서버 오류</h3>
        <label>앱 <select value={selected} onChange={e => select(e.target.value)}>
          <option value="">전체</option>{apps.map(a => <option key={a}>{a}</option>)}
        </select></label>
      </div>
      {errors.length === 0 ? <p>기록된 서버 오류가 없습니다.</p> :
        <ul className="ops-list">{errors.map(e => <li key={e.app + ':' + e.operation + ':' + e.status}>
          <strong>{e.app} · {e.operation}</strong>
          <span>HTTP {e.status} · {e.count}회 · 마지막 {clock.format(e.lastMs)}</span>
          <small>최근 요청 ID: {e.requestId}</small>
        </li>)}</ul>}
      <h3>관리자 변경 이력</h3>
      {data.changes.length === 0 ? <p>오늘 변경된 관리자 설정이 없습니다.</p> :
        <ol className="ops-list">{data.changes.map(c => <li key={c.id}>
          <strong>{clock.format(c.atMs)} · {c.action === 'USER_CLASS' ? '회원 등급 변경' : '추천 앱 변경'}</strong>
          <span>{c.before} → {c.after}</span>
          <small>관리자 {c.actor}{c.action === 'USER_CLASS' && ' · 대상 회원 ' + c.target}</small>
        </li>)}</ol>}
      {data.nextCursor && <button type="button" disabled={busy} className="btn-secondary"
        onClick={() => void load(data.nextCursor!, data.date)}>이전 변경 더 보기</button>}
    </>}
  </section>;
}
