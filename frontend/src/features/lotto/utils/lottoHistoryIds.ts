let lastId = 0
/** Shared by generation and photo imports, including batches awaiting async work. */
export function allocateLottoHistoryIds(count: number, existingIds: number[]): number[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('번호 개수가 올바르지 않습니다.')
  let base = Math.max(Date.now(), lastId + 1)
  for (const id of existingIds) if (Number.isSafeInteger(id)) base = Math.max(base, id + 1)
  if (!Number.isSafeInteger(base + count)) throw new Error('내역 ID를 생성하지 못했습니다.')
  lastId = base + count - 1
  return Array.from({ length: count }, (_, i) => base + i)
}
