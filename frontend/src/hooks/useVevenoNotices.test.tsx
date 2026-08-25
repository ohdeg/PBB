// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import type { FormEvent, ReactNode, SetStateAction } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { vevenoApi } from '../api/vevenoApi'
import { VevenoI18nProvider } from '../features/veveno/i18n/LanguageContext'
import type { VevenoNotice, VevenoStore } from '../types/veveno'
import { useVevenoNotices } from './useVevenoNotices'

vi.mock('../api/vevenoApi', () => ({
  vevenoApi: {
    createNotice: vi.fn(),
    updateNotice: vi.fn(),
    deleteNotice: vi.fn(),
  },
}))

const ownerStore: VevenoStore = {
  id: 'store-1',
  ownerUserId: 'owner-1',
  name: 'Test Store',
  isPublic: true,
  inviteCode: 'INVITE',
  owned: true,
  subscribed: false,
  canEditStock: true,
  onDuty: true,
  stockEditOffDuty: false,
  stockUsageHint: false,
  leaveDate: null,
  createdAt: '2026-07-27T00:00:00Z',
  updatedAt: '2026-07-27T00:00:00Z',
}

const createdNotice: VevenoNotice = {
  id: 'notice-1',
  storeId: ownerStore.id,
  authorUserId: ownerStore.ownerUserId,
  authorNickname: 'owner',
  title: '새 공지',
  body: '공지 내용',
  createdAt: '2026-07-27T00:00:00Z',
  updatedAt: '2026-07-27T00:00:00Z',
}

describe('useVevenoNotices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <VevenoI18nProvider locale="ko">{children}</VevenoI18nProvider>
  )

  it('creates an owner notice and resets the form', async () => {
    vi.mocked(vevenoApi.createNotice).mockResolvedValue({
      data: createdNotice,
    } as AxiosResponse<VevenoNotice>)
    const setError = vi.fn<(value: SetStateAction<string>) => void>()
    const { result } = renderHook(() =>
      useVevenoNotices({
        store: ownerStore,
        storeId: ownerStore.id,
        setError,
      }),
      { wrapper },
    )

    act(() => {
      result.current.setNoticeForm({
        title: ` ${createdNotice.title} `,
        body: ` ${createdNotice.body} `,
      })
    })
    await act(async () => {
      await result.current.handleSaveNotice(
        new Event('submit') as unknown as FormEvent,
      )
    })

    expect(vevenoApi.createNotice).toHaveBeenCalledWith(ownerStore.id, {
      title: createdNotice.title,
      body: createdNotice.body,
    })
    expect(result.current.notices).toEqual([createdNotice])
    expect(result.current.noticeForm).toEqual({ title: '', body: '' })
    expect(setError).toHaveBeenCalledWith('')
  })

  it('blocks notice creation for a non-owner', async () => {
    const setError = vi.fn<(value: SetStateAction<string>) => void>()
    const { result } = renderHook(() =>
      useVevenoNotices({
        store: { ...ownerStore, owned: false },
        storeId: ownerStore.id,
        setError,
      }),
      { wrapper },
    )

    await act(async () => {
      await result.current.handleSaveNotice(
        new Event('submit') as unknown as FormEvent,
      )
    })

    expect(vevenoApi.createNotice).not.toHaveBeenCalled()
  })
})
