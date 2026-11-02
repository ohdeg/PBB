import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Upload } from 'lucide-react';
import type { LibraryTemporiItem } from '../types/library';

interface Props {
  item: LibraryTemporiItem; account: boolean; uploading: boolean; open: boolean;
  onOpenChange: (open: boolean) => void; onDelete: () => void; onUpload: () => void;
}
export function TemporiLibraryItem({ item, account, uploading, open, onOpenChange, onDelete, onUpload }: Props) {
  const row = useRef<HTMLLIElement>(null); const menu = useRef<HTMLButtonElement>(null); const actions = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; initial: number; width: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false); const [drag, setDrag] = useState<number | null>(null); const [touchMenu, setTouchMenu] = useState(false);
  const canUpload = account && item.syncState !== 'saved';
  useEffect(() => {
    if (!open) return;
    const outside = (event: globalThis.PointerEvent) => { if (!row.current?.contains(event.target as Node)) onOpenChange(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { onOpenChange(false); menu.current?.focus(); } };
    const resize = () => { setDrag(null); gesture.current = null; onOpenChange(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', resize); };
  }, [open, onOpenChange]);
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !event.isPrimary || (event.target as Element).closest('button')) return;
    suppressClick.current = false; setTouchMenu(true);
    const width = Math.min(canUpload ? 184 : 92, row.current?.clientWidth || 184);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: open ? width : 0, width, dragging: false };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current; if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x; const dy = event.clientY - current.y;
    if (!current.dragging) {
      if (Math.abs(dy) >= 12 && Math.abs(dy) >= Math.abs(dx) / 1.5) { gesture.current = null; return; }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      current.dragging = true; suppressClick.current = true; event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDrag(Math.max(0, Math.min(current.width, current.initial - dx)));
  };
  const finish = (cancel: boolean) => {
    const current = gesture.current;
    if (current?.dragging) onOpenChange(!cancel && (drag ?? current.initial) >= current.width * .35);
    gesture.current = null; setDrag(null);
  };
  const revealed = open || drag !== null;
  return <li ref={row} className={`tempori-library-row${open ? ' is-open' : ''}${touchMenu ? ' is-touch-menu' : ''}${drag !== null ? ' is-dragging' : ''}`} style={{ '--tempori-action-width': `${canUpload ? 184 : 92}px` } as React.CSSProperties}>
    <div ref={actions} className="tempori-library-actions" aria-label="악보 작업" aria-hidden={!open} inert={!open} hidden={!revealed}>
      <button type="button" disabled={uploading} tabIndex={open ? 0 : -1} onClick={onDelete}>삭제</button>
      {canUpload && <button type="button" disabled={uploading} tabIndex={open ? 0 : -1} onClick={onUpload}><Upload size={16} aria-hidden="true" />{uploading ? '업로드 중…' : item.syncState === 'failed' ? '다시 업로드' : '업로드'}</button>}
    </div>
    <div className="tempori-library-card" style={drag === null ? undefined : { transform: `translateX(-${drag}px)` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)} onClickCapture={(event) => {
      if ((event.target as Element).closest('button')) return;
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; return; }
      if (open) { event.preventDefault(); event.stopPropagation(); onOpenChange(false); }
    }}>
      <Link to={`/hobbies/tempori/${item.id}`} className="tempori-list-item tempori-list-item--link" aria-label={item.title}>
        <strong title={item.title}>{item.title}</strong>
        <span className="tempori-sync-note">{uploading ? '업로드 중…' : item.syncState === 'saved' ? item.stateSyncPending ? '계정 저장됨 · 연습 상태 동기화 대기' : '계정 저장됨' : item.syncState === 'failed' ? '업로드 실패 · 기기 원본 보관 중' : '이 기기에만 있음'}</span>
        {item.artist && <span className="tempori-artist">{item.artist}</span>}
      </Link>
      <button ref={menu} type="button" className="tempori-library-menu" aria-label="악보 메뉴" aria-expanded={open} onClick={(event) => {
        setTouchMenu(event.detail > 0 && (event.nativeEvent as globalThis.PointerEvent).pointerType === 'touch' || window.matchMedia?.('(max-width: 1024px)').matches === true);
        onOpenChange(!open);
      }}><MoreHorizontal size={20} aria-hidden="true" /></button>
    </div>
  </li>;
}
