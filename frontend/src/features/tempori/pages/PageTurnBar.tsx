import { TemporiDockSlot } from '../../../components/TemporiViewerDock';
import type { PageTurnRequest } from './types';
export function PageTurnBar({ index, count, busy, request }: { index: number; count: number; busy: boolean; request: (input: PageTurnRequest) => void }) {
  return <TemporiDockSlot slot="pages"><nav className="tempori-page-turn-bar" aria-label="악보 페이지 이동">
    <button type="button" disabled={busy || index <= 0} onClick={() => request({ delta: -1, origin: 'bottom', timestamp: performance.now() })}>이전 페이지</button>
    <output aria-live="polite" aria-atomic="true">{count ? index + 1 : 0} / {count} 페이지</output>
    <button type="button" disabled={busy || index >= count - 1} onClick={() => request({ delta: 1, origin: 'bottom', timestamp: performance.now() })}>다음 페이지</button>
  </nav></TemporiDockSlot>;
}
