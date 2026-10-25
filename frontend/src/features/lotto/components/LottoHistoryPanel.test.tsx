// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LottoHistoryItem } from '../../../types/lotto'
import { LottoHistoryPanel } from './LottoHistoryPanel'
const pending: LottoHistoryItem = { id: 1, name: 'pending', category: '', reviews: '', icon: '', color: '', targetRound: 1201, status: 'pending' }
const winner: LottoHistoryItem = { ...pending, id: 2, name: 'winner', targetRound: 1200, status: 'won', prizeRank: 3 }
const props = () => ({ items: [pending, winner], currentRound: 1201, onRemove: vi.fn(), onExport: vi.fn(), renderMeta: () => null, renderNumbers: (item: LottoHistoryItem) => <span>{item.name}</span>, error: '', loading: false, saving: false, onRetry: vi.fn(), noticeMessage: '', onAcknowledge: vi.fn() })
describe('LottoHistoryPanel', () => {
  it('scopes bulk export/delete to active tab and clears selection when switching tabs', () => {
    const input = props(); vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LottoHistoryPanel {...input} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /pending 선택/ }))
    fireEvent.click(screen.getByRole('tab', { name: '당첨 보관함' }))
    expect(screen.getByRole('checkbox', { name: /winner 선택/ })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: '전체 이미지 저장' }))
    expect(input.onExport).toHaveBeenCalledWith([winner])
    fireEvent.click(screen.getByRole('button', { name: '전체 삭제' }))
    expect(input.onRemove).toHaveBeenCalledWith([2])
  })
  it('supports keyboard tab navigation and independent checkbox/actions', () => {
    const input = props(); render(<LottoHistoryPanel {...input} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: '이번 회차' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: '당첨 보관함' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'winner 이 번호만 저장' }))
    expect(screen.getByRole('checkbox', { name: 'winner 선택' })).not.toBeChecked()
  })
  it('keeps both tabs connected to the existing panel before and after switching', () => {
    render(<LottoHistoryPanel {...props()} />)
    const assertControls = () => {
      const panel = screen.getByRole('tabpanel')
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab.getAttribute('aria-controls')).toBe(panel.id)
        expect(document.getElementById(tab.getAttribute('aria-controls')!)).toBe(panel)
      }
      const active = screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')!
      expect(panel.getAttribute('aria-labelledby')).toBe(active.id)
    }
    assertControls()
    fireEvent.click(screen.getByRole('tab', { name: '당첨 보관함' }))
    assertControls()
  })
  it('shows private exact notice and archive CTA acknowledges without displaying prize details in notice', () => {
    const input = { ...props(), noticeMessage: '축하드립니다. 이번 주 당첨된 번호가 있습니다.' }
    render(<LottoHistoryPanel {...input} />)
    expect(screen.getByRole('status', { name: '당첨 알림' }).textContent).not.toMatch(/3등|1200|winner/)
    fireEvent.click(screen.getByRole('button', { name: '당첨 보관함 보기' }))
    expect(input.onAcknowledge).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('tab', { name: '당첨 보관함' })).toHaveAttribute('aria-selected', 'true')
  })
  it('shows retry and labels older pending results instead of hiding them', () => {
    const input = { ...props(), items: [{ ...pending, targetRound: 1199 }], error: '저장하지 못했습니다.' }
    render(<LottoHistoryPanel {...input} />)
    expect(screen.getByText('1199회 · 결과 확인 대기')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); expect(input.onRetry).toHaveBeenCalledTimes(1)
  })
})
