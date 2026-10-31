import { describe, expect, it } from 'vitest'
import { parseLottoTicket, validateTicket, previewTicketImport, buildTicketHistoryItems, duplicateTicketLines } from './ticketImport'
import { allocateLottoHistoryIds } from './lottoHistoryIds'
const ticket = { targetRound: 1200, rows: [{ line: 'A' as const, numbers: [1,2,3,4,5,6] }] }
const draw = { round: 1200, mainNumbers: [1,2,3,4,5,6], bonusNumber: 7 }
describe('photo ticket import', () => {
  it('reads only labelled rows and a single explicit round', () => {
    expect(parseLottoTicket(['제 1200 회', '2026/10/31 5,000원', 'A 자동 01 02 03 04 05 06', 'B 수동 07 08 09 10 11 12'])).toMatchObject({detectedRound:1200,rows:[{line:'A',values:[1,2,3,4,5,6]},{line:'B',values:[7,8,9,10,11,12]}]})
  })
  it('never fills missing tokens by merging rows, splitting joined digits or guessing glyphs', () => {
    const parsed = parseLottoTicket(['1200회', 'A 자동 010203 04 O5 06', '07 08 09', 'B 자동 01 02 03 04 05 06'])
    expect(parsed.rows[0].values).not.toEqual([1,2,3,4,5,6]); expect(parsed.rows[0].needsReview).toBe(true)
    expect(parsed.rows[1].values).toEqual([1,2,3,4,5,6])
    expect(parseLottoTicket(['1200회','1201회']).detectedRound).toBeNull()
  })
  it('validates six unique numbers and known next round', () => {
    expect(validateTicket(ticket,1200)).toBe('')
    expect(validateTicket({...ticket,targetRound:1202},1200)).toContain('회차')
    expect(validateTicket({...ticket,rows:[{line:'A',numbers:[0,1,2,3,4,4]}]},1200)).toContain('A')
    expect(validateTicket({...ticket,rows:[]},1200)).not.toBe('')
  })
  it('shares settlement and fingerprints only related draws', () => {
    const p=previewTicketImport(ticket,[draw]); expect(p).toMatchObject({waiting:0,won:1,discarded:0})
    expect(previewTicketImport(ticket,[draw,{...draw,round:1199}]).fingerprint).toBe(p.fingerprint)
    expect(previewTicketImport(ticket,[{...draw,bonusNumber:8}]).fingerprint).not.toBe(p.fingerprint)
    expect(previewTicketImport(ticket,[])).toMatchObject({waiting:1,won:0,discarded:0})
    expect(previewTicketImport(ticket,[{...draw,mainNumbers:[10,11,12,13,14,15]}])).toMatchObject({waiting:0,won:0,discarded:1})
  })
  it('stores provenance only and warns about intentional duplicate tickets', () => {
    const items=buildTicketHistoryItems(ticket,[1],'2026-10-31T00:00:00Z')
    expect(items[0]).toMatchObject({source:'ticket-photo',ticketLine:'A',registeredAt:'2026-10-31T00:00:00Z',status:'pending'})
    expect(items[0].drawnAt).toBeUndefined(); expect(duplicateTicketLines(ticket,items)).toEqual(['A'])
  })
  it('allocates globally unique safe numeric ids across batches and old ids', () => {
    const a=allocateLottoHistoryIds(5,[Date.now()+1000]); const b=allocateLottoHistoryIds(5,[])
    expect(new Set([...a,...b]).size).toBe(10); expect(a.every(Number.isSafeInteger)).toBe(true); expect(b[0]).toBeGreaterThan(a[4])
  })
})
