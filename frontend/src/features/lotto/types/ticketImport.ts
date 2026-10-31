export type TicketLine = 'A' | 'B' | 'C' | 'D' | 'E'
export const TICKET_LINES: TicketLine[] = ['A', 'B', 'C', 'D', 'E']
export interface TicketOcrDraft {
  detectedRound: number | null
  rows: { line: TicketLine; values: (number | null)[]; needsReview: boolean }[]
  warnings: string[]
}
export interface ConfirmedTicket {
  targetRound: number
  rows: { line: TicketLine; numbers: number[] }[]
}
export interface TicketImportPreview {
  waiting: number
  won: number
  discarded: number
  fingerprint: string
}
