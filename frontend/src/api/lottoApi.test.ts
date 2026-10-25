import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './axios'
import { lottoApi } from './lottoApi'
vi.mock('./axios', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }))
describe('lotto picks JSON', () => {
  beforeEach(() => vi.clearAllMocks())
  it('saves all items without silently dropping items after 200', async () => {
    const items = Array.from({ length: 205 }, (_, id) => ({ id, name: '', category: '', reviews: '', icon: '', color: '' }))
    vi.mocked(apiClient.put).mockResolvedValue({ data: { targetRound: null, itemsJson: JSON.stringify(items) } })
    await lottoApi.savePicks(null, items)
    expect(JSON.parse(vi.mocked(apiClient.put).mock.calls[0][1]!.itemsJson)).toHaveLength(205)
  })
  it.each(['invalid', '{}', '[null]', '[{"id":1}]'])('rejects corrupt saved history %s without replacing it with []', async (itemsJson) => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { targetRound: null, itemsJson } })
    await expect(lottoApi.getPicks()).rejects.toThrow()
  })
  it('propagates the backend size-cap error', async () => {
    const failure = new Error('히스토리가 너무 큽니다.')
    vi.mocked(apiClient.put).mockRejectedValue(failure)
    await expect(lottoApi.savePicks(null, [])).rejects.toBe(failure)
  })
})
