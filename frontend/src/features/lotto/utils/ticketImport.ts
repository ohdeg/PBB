import type { LottoDraw, LottoHistoryItem } from '../../../types/lotto'
import type { ConfirmedTicket, TicketImportPreview, TicketOcrDraft, TicketLine } from '../types/ticketImport'
import { settleLottoHistory } from './lottoHistory'

export function parseLottoTicket(lines: string[]): TicketOcrDraft {
  const rounds = new Set<number>()
  const rows: TicketOcrDraft['rows'] = []
  const seen = new Set<string>()
  for (const text of lines) {
    for (const match of text.matchAll(/(?:제\s*)?(\d{1,7})\s*회/g)) rounds.add(Number(match[1]))
    const match = text.trim().match(/^([A-E])\s+(?:(?:반자동|자동|수동)\s*)?(.*)$/)
    if (!match) continue
    const tokens = match[2].trim().split(/\s+/)
    const values = Array.from({ length: 6 }, (_, i) => /^\d{1,2}$/.test(tokens[i] ?? '') ? Number(tokens[i]) : null)
    const valid = tokens.length === 6 && values.every(n => n !== null && n >= 1 && n <= 45) && new Set(values).size === 6
    if (seen.has(match[1])) {
      const old = rows.find(row => row.line === match[1])!
      old.values = Array(6).fill(null); old.needsReview = true
      continue
    }
    seen.add(match[1])
    rows.push({ line: match[1] as TicketLine, values, needsReview: !valid })
  }
  return {
    detectedRound: rounds.size === 1 && [...rounds][0] > 0 ? [...rounds][0] : null,
    rows: rows.sort((a,b) => a.line.localeCompare(b.line)),
    warnings: rows.length ? [] : ['번호 줄을 읽지 못했습니다. 사진을 다시 선택하거나 직접 입력해 주세요.'],
  }
}

export function validateTicket(ticket: ConfirmedTicket, latestRound: number): string {
  if (!Number.isSafeInteger(ticket.targetRound) || ticket.targetRound < 1 || ticket.targetRound > latestRound + 1) return '회차를 확인해 주세요.'
  if (ticket.rows.length < 1 || ticket.rows.length > 5 || new Set(ticket.rows.map(r => r.line)).size !== ticket.rows.length) return '저장할 줄을 선택해 주세요.'
  for (const row of ticket.rows) {
    if (row.numbers.length !== 6 || new Set(row.numbers).size !== 6 || row.numbers.some(n => !Number.isInteger(n) || n < 1 || n > 45)) return `${row.line}줄에 서로 다른 1~45 번호 여섯 개를 입력해 주세요.`
  }
  return ''
}

export function buildTicketHistoryItems(ticket: ConfirmedTicket, ids: number[], registeredAt: string): LottoHistoryItem[] {
  return ticket.rows.map((row,i) => ({
    id: ids[i], name: `용지 등록 · ${row.line}`, category: '용지 등록', reviews: '', icon: '🎟️', color: 'blue',
    targetRound: ticket.targetRound, numbers: [...row.numbers].sort((a,b)=>a-b), status: 'pending',
    source: 'ticket-photo', ticketLine: row.line, registeredAt,
  }))
}

export function previewTicketImport(ticket: ConfirmedTicket, draws: LottoDraw[]): TicketImportPreview {
  const items = buildTicketHistoryItems(ticket, ticket.rows.map((_,i)=>i+1), '')
  const settled = settleLottoHistory(items, draws)
  const relevant = draws.filter(d => d.round === ticket.targetRound)
  return {
    waiting: settled.filter(i=>i.status !== 'won').length,
    won: settled.filter(i=>i.status === 'won').length,
    discarded: items.length - settled.length,
    fingerprint: JSON.stringify([ticket, relevant.map(d => [d.round, [...d.mainNumbers].sort((a,b)=>a-b), d.bonusNumber])]),
  }
}

const key = (round: number | null | undefined, numbers: number[] = []) => `${round}:${[...numbers].sort((a,b)=>a-b).join(',')}`
export function duplicateTicketLines(ticket: ConfirmedTicket, history: LottoHistoryItem[]): TicketLine[] {
  const seen = new Set(history.map(i => key(i.targetRound,i.numbers)))
  return ticket.rows.flatMap(row => {
    const k=key(ticket.targetRound,row.numbers); const duplicate=seen.has(k); seen.add(k)
    return duplicate ? [row.line] : []
  })
}
