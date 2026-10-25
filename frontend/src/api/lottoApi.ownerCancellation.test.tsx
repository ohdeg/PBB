// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from './axios'
import { getLottoHistoryOwner, useLottoHistory } from '../features/lotto/hooks/useLottoHistory'
import { useAuthStore } from '../stores/authStore'
import type { LottoHistoryItem } from '../types/lotto'

const originalAdapter = apiClient.defaults.adapter
const login = (userId: string) => useAuthStore.setState({ accessToken: `token-${userId}`, userId, email: `${userId}@example.com` })
const flush = async () => { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }) }

function tokenFor(userId: string): string {
  const payload = btoa(JSON.stringify({ userId, sub: `${userId}@example.com`, nickname: `User ${userId}` }))
  return `header.${payload}.signature`
}
function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, data, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
}

afterEach(() => { apiClient.defaults.adapter = originalAdapter; useAuthStore.getState().clearAuth() })

describe('picks cancellation through the actual Axios refresh interceptor', () => {
  it('does not replay an A snapshot after B login while its 401 refresh is deferred', async () => {
    let finishRefresh!: (value: AxiosResponse) => void
    let refreshConfig!: InternalAxiosRequestConfig
    let putAttempts = 0
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshConfig = config
        return new Promise<AxiosResponse>((resolve) => { finishRefresh = resolve })
      }
      if (config.method === 'put') {
        putAttempts++
        throw new axios.AxiosError(
          'expired', 'ERR_BAD_REQUEST', config, undefined,
          { ...response(config, {}), status: 401, statusText: 'Unauthorized' },
        )
      }
      return response(config, { targetRound: null, itemsJson: '[]' })
    }
    login('A')
    const { result, unmount } = renderHook(() => {
      const owner = useAuthStore(getLottoHistoryOwner)
      return useLottoHistory(owner, [])
    })
    await flush()
    const item: LottoHistoryItem = {
      id: 1, name: 'A only', category: '', reviews: '', icon: '', color: '',
      numbers: [1, 2, 3, 4, 5, 6], targetRound: 1200, status: 'pending',
    }
    act(() => result.current.append([item]))
    await flush()
    expect(putAttempts).toBe(1)
    expect(finishRefresh).toBeTypeOf('function')
    act(() => login('B'))
    expect(result.current.history).toEqual([])
    await act(async () => finishRefresh(response(refreshConfig, { accessToken: tokenFor('A') })))
    await flush()
    expect(putAttempts).toBe(1)
    // The original PUT retains the aborted signal even if refresh changes auth again.
    unmount()
  })
})
