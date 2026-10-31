import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LottoHistoryItem } from '../../../types/lotto'
import { formatLottoDrawnDateTime } from '../utils/lottoDateFormat'
import {
  getHistoryActionItems,
  getHistoryForTab,
  type LottoHistoryTab,
} from '../utils/lottoHistory'

interface Props {
  activeTab?: LottoHistoryTab
  onTabChange?: (tab: LottoHistoryTab) => void
  items: LottoHistoryItem[]
  currentRound: number
  onRemove: (ids: number[]) => void
  onExport: (items: LottoHistoryItem[]) => void
  renderMeta: (item: LottoHistoryItem) => ReactNode
  renderNumbers: (item: LottoHistoryItem) => ReactNode
  error: string
  loading: boolean
  saving: boolean
  onRetry: () => void
  noticeMessage: string
  onAcknowledge: () => void
}
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

function roundLabel(item: LottoHistoryItem, currentRound: number): string {
  const round = item.targetRound == null ? '회차 미확인' : `${item.targetRound}회`
  if (item.status === 'won') return `${round} · ${item.prizeRank}등`
  if (item.targetRound == null || item.targetRound < currentRound) {
    return `${round} · 결과 확인 대기`
  }
  return `${round} · 추첨 대기`
}

export function LottoHistoryPanel(props: Props) {
  const [localTab, setTab] = useState<LottoHistoryTab>('pending')
  const tab = props.activeTab ?? localTab
  const [selected, setSelected] = useState<number[]>([])
  useEffect(() => { setSelected([]) }, [tab])
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const id = useId()
  const visible = getHistoryForTab(props.items, tab)
  const activeSelected = selected.filter((selectedId) =>
    visible.some((item) => item.id === selectedId),
  )

  const switchTab = (next: LottoHistoryTab) => {
    setTab(next)
    props.onTabChange?.(next)
    setSelected([])
  }
  const onTabKey = (event: KeyboardEvent, index: number) => {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else return
    event.preventDefault()
    switchTab(next === 0 ? 'pending' : 'won')
    tabRefs.current[next]?.focus()
  }
  const deleteItems = (items: LottoHistoryItem[]) => {
    const question = tab === 'won'
      ? '선택한 당첨 기록을 보관함에서 삭제하시겠습니까?'
      : '선택한 추첨 기록을 삭제하시겠습니까?'
    if (!window.confirm(question)) return
    props.onRemove(items.map((item) => item.id))
    setSelected([])
  }
  const openArchive = () => {
    switchTab('won')
    props.onAcknowledge()
    tabRefs.current[1]?.focus()
  }

  return (
    <section className="lotto-history min-w-0 space-y-4" aria-label="내 번호">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-slate-900">내 번호</h2>
        <p className="text-sm text-slate-500">생성한 번호와 당첨 기록을 확인할 수 있습니다.</p>
      </div>
      {props.noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-label="당첨 알림"
          className="lotto-history__notice rounded-2xl border p-4"
        >
          <p className="text-sm font-bold">{props.noticeMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`lotto-history__notice-action lotto-history__notice-action--archive min-h-11 rounded-lg px-3 py-2 text-sm font-bold ${focus}`}
              onClick={openArchive}
            >
              당첨 보관함 보기
            </button>
            <button
              type="button"
              className={`lotto-history__notice-action lotto-history__notice-action--dismiss min-h-11 rounded-lg px-3 py-2 text-sm font-bold ${focus}`}
              onClick={props.onAcknowledge}
            >
              알림 닫기
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite" className="space-y-2">
        {props.error && (
          <div className="lotto-history__error flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
            <p>{props.error}</p>
            <button
              type="button"
              onClick={props.onRetry}
              className={`lotto-history__error-action min-h-11 shrink-0 rounded-lg px-3 py-2 font-bold ${focus}`}
            >
              다시 시도
            </button>
          </div>
        )}
        {props.loading && (
          <p className="text-xs text-slate-500">저장된 추첨 내역을 불러오는 중…</p>
        )}
        {props.saving && (
          <p className="text-xs text-slate-500">변경 내용을 저장하는 중… 알림 확인도 저장 후 완료됩니다.</p>
        )}
      </div>
      <div role="tablist" aria-label="추첨 내역 분류" className="flex gap-2 rounded-xl bg-slate-100 p-1">
        {(['pending', 'won'] as const).map((value, index) => (
          <button
            key={value}
            ref={(element) => { tabRefs.current[index] = element }}
            type="button"
            role="tab"
            id={`${id}-tab-${value}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => switchTab(value)}
            onKeyDown={(event) => onTabKey(event, index)}
            className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-black ${focus} ${tab === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            {value === 'pending' ? '이번 회차' : '당첨 보관함'}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
        tabIndex={0}
        className={`min-w-0 space-y-3 rounded-xl ${focus}`}
      >
        <p className="text-sm text-slate-500">
          {tab === 'won'
            ? '당첨된 기록은 직접 삭제할 때까지 보관됩니다.'
            : '결과를 기다리는 이전 회차 번호도 함께 표시됩니다.'}
        </p>
        {visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 py-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                aria-label="전체 선택"
                checked={activeSelected.length === visible.length}
                onChange={() => setSelected(
                  activeSelected.length === visible.length ? [] : visible.map((item) => item.id),
                )}
                className={`h-4 w-4 accent-blue-600 ${focus}`}
              />
              전체 선택
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => props.onExport(getHistoryActionItems(props.items, tab, activeSelected))}
                className={`lotto-history__export min-h-11 rounded-lg px-3 py-2 text-sm font-bold ${focus}`}
              >
                {activeSelected.length ? '선택 이미지 저장' : '전체 이미지 저장'}
              </button>
              <button
                type="button"
                onClick={() => deleteItems(getHistoryActionItems(props.items, tab, activeSelected))}
                className={`lotto-history__delete min-h-11 rounded-lg px-3 py-2 text-sm font-bold ${focus}`}
              >
                {activeSelected.length ? '선택 삭제' : '전체 삭제'}
              </button>
            </div>
          </div>
        )}
        {visible.map((item) => (
          <article
            key={item.id}
            data-status={item.status}
            className={`lotto-history__card grid min-w-0 items-center gap-x-2 gap-y-2 rounded-2xl border bg-white p-3 sm:p-5 ${activeSelected.includes(item.id) ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-100'}`}
          >
            <label className="lotto-history__select flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg" aria-label={`${item.name} 선택`}>
              <input
                type="checkbox"
                aria-label={`${item.name} 선택`}
                checked={activeSelected.includes(item.id)}
                onChange={() => setSelected((previous) => previous.includes(item.id)
                  ? previous.filter((value) => value !== item.id)
                  : [...previous, item.id],
                )}
                className={`h-5 w-5 accent-blue-600 ${focus}`}
              />
            </label>
            <div className={`lotto-history__icon hidden h-10 w-10 items-center justify-center rounded-xl text-xl sm:flex ${item.color}`}>
              {item.icon}
            </div>
            <div className="lotto-history__body min-w-0">
              <p className={`lotto-history__round mb-1 text-sm font-bold ${tab === 'won' ? 'text-amber-800' : 'text-blue-700'}`}>
                {roundLabel(item, props.currentRound)}
              </p>
              <div className="lotto-history__numbers min-w-0">{props.renderNumbers(item)}</div>
              <div className="lotto-history__meta mt-2 min-w-0">
                {props.renderMeta(item)}
                <p className="text-xs font-medium text-slate-500">
                  {item.registeredAt ? `등록 ${formatLottoDrawnDateTime(item.registeredAt)}` : item.drawnAt ? formatLottoDrawnDateTime(item.drawnAt) : item.reviews}
                </p>
                {item.isNumberPoolResetStart && (
                  <p className="mt-2 text-xs font-bold text-amber-800">번호 풀 초기화 지점</p>
                )}
                {item.isSetBlockStart && (
                  <p className="mt-2 text-xs font-bold text-blue-800">
                    {item.sixSetOrdinal != null ? `세트 ${item.sixSetOrdinal}(6게임) 시작` : '1세트(6게임) 시작'}
                  </p>
                )}
              </div>
            </div>
            <div className="lotto-history__actions flex shrink-0 gap-1 sm:flex-col sm:border-l sm:border-slate-100 sm:pl-2">
              <button
                type="button"
                aria-label={`${item.name} 이 번호만 저장`}
                title="이 번호를 이미지로 저장"
                onClick={() => props.onExport([item])}
                className={`lotto-history__export flex h-11 w-11 items-center justify-center rounded-full ${focus}`}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
                </svg>
              </button>
              <button
                type="button"
                aria-label={`${item.name} 기록 삭제`}
                title="기록 삭제"
                onClick={() => deleteItems([item])}
                className={`lotto-history__delete flex h-11 w-11 items-center justify-center rounded-full ${focus}`}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
                </svg>
              </button>
            </div>
          </article>
        ))}
        {visible.length === 0 && !props.loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm font-bold text-slate-500">
            {tab === 'won'
              ? '아직 보관된 당첨 번호가 없습니다.'
              : '결과를 기다리는 번호가 없습니다. 새 번호를 생성해 보세요.'}
          </div>
        )}
      </div>
    </section>
  )
}
