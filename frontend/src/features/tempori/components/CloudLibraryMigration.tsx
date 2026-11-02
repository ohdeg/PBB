import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { currentAccount, captureCloudSession, listCloudScores, scoreHash } from '../services/temporiCloudApi';
import { localMigrationCandidates, migrateLocalScore, migrationJobs, restartDeletedMigration } from '../services/temporiMigration';
import { getLocalLibraryUserId } from '../utils/libraryUserId';
interface Candidate { id: string; title: string; artist: string | null; size: number; saved: boolean; duplicate: boolean; deleted: boolean }
export function CloudLibraryMigration({ account, accountLabel, onClose, onComplete }: { account: string; accountLabel: string; onClose: () => void; onComplete: () => void }) {
  const [items, setItems] = useState<Candidate[]>([]); const [selected, setSelected] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [completed, setCompleted] = useState(0);
  useEffect(() => { let cancelled = false;
    void (async () => { try {
      const [local, remote, jobs] = await Promise.all([localMigrationCandidates(), listCloudScores(), migrationJobs(account)]);
      const candidates: Candidate[] = [];
      for (const item of local) { const hash = await scoreHash(new Blob([item.fileData])); candidates.push({ id: item.id, title: item.title, artist: item.artist, size: item.fileData.byteLength, saved: jobs.some((job) => job.localId === item.id && job.state === 'saved' && remote.some((row) => row.id === job.serverId)), duplicate: remote.some((score) => score.sha256 === hash), deleted: jobs.some((job) => job.localId === item.id && job.state === 'saved' && !remote.some((row) => row.id === job.serverId)) }); }
      if (!cancelled && currentAccount() === account) setItems(candidates);
    } catch { if (!cancelled) setError('이 기기의 악보와 계정 보관함을 확인하지 못했습니다. 닫은 후 다시 시도해 주세요.'); }
    finally { if (!cancelled) setLoading(false); } })(); return () => { cancelled = true; };
  }, [account]);
  const transfer = async () => {
    const session = captureCloudSession();
    if (session.account !== account) return;
    setBusy(true); setError(''); setCompleted(0);
    try {
      for (const id of selected) {
        session.assert();
        const item = items.find((item) => item.id === id)!;
        if (item.deleted) { await restartDeletedMigration(account, id); session.assert(); }
        await migrateLocalScore(id, getLocalLibraryUserId(), item.title, item.artist ?? undefined);
        session.assert();
        session.assert();
        setCompleted((value) => value + 1); setItems((previous) => previous.map((row) => row.id === id ? { ...row, saved: true } : row));
      }
      setSelected([]); onComplete();
    } catch (failure) { if (currentAccount() === account) setError(failure instanceof Error ? failure.message : '저장하지 못했습니다. 같은 선택으로 재시도할 수 있습니다.'); }
    finally { if (currentAccount() === account) setBusy(false); }
  };
  return <section className="tempori-migration" aria-label="이 기기의 악보를 계정에 저장"><h2>이 기기의 악보를 계정에 저장</h2>
    <p>대상 계정: <strong>{accountLabel}</strong></p><p>선택한 원본만 저장합니다. 기기의 사본과 필기는 유지되며, 필기·연습 위치·보기 설정은 다른 기기로 전송되지 않습니다.</p>
    {loading && <p role="status">기기 원본을 확인하고 있습니다…</p>}
    <ul>{items.map((item) => <li key={item.id}><label><input type="checkbox" disabled={busy || item.saved} checked={selected.includes(item.id)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id))} /><span>{item.title} · {(item.size / 1024 / 1024).toFixed(1)} MiB {item.saved ? '· 계정에 저장됨' : item.duplicate ? '· 같은 원본이 계정에 있음' : ''}</span></label></li>)}</ul>
    {!loading && !items.length && <p>이 기기에 이전할 악보가 없습니다.</p>}
    <p>{selected.length}개 선택 · {(items.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(1)} MiB</p>
    {busy && <p role="status">서버에 저장 중 · {completed} / {selected.length}</p>}{error && <p role="alert">{error}</p>}
    <Button disabled={busy || !selected.length} onClick={() => void transfer()}>{error ? '선택한 악보 저장 재시도' : '선택한 악보를 계정에 저장'}</Button><Button variant="secondary" disabled={busy} onClick={onClose}>닫기</Button>
  </section>;
}
