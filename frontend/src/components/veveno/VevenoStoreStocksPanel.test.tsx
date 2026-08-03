// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vevenoApi } from '../../api/vevenoApi'
import type { VevenoStock, VevenoStockCategory } from '../../types/veveno'
import { VevenoStoreStocksPanel } from './VevenoStoreStocksPanel'

vi.mock('../../api/vevenoApi', () => ({
  vevenoApi: {
    createStockCategory: vi.fn(),
    updateStockCategory: vi.fn(),
    deleteStockCategory: vi.fn(),
    createStock: vi.fn(),
    updateStock: vi.fn(),
    listStocks: vi.fn(),
  },
}))

const categories: VevenoStockCategory[] = [
  {
    id: 1,
    storeId: 'store-1',
    categoryName: '원두',
    createdAt: '2026-07-27T00:00:00Z',
    stocks: [
      {
        id: 10,
        categoryId: 1,
        stockName: '에티오피아',
        stockNum: 2,
        stockMinNum: 1,
        version: 0,
        lowStock: false,
        updatedAt: '2026-07-27T00:00:00Z',
      },
    ],
  },
  {
    id: 2,
    storeId: 'store-1',
    categoryName: '우유',
    createdAt: '2026-07-27T00:00:00Z',
    stocks: [
      {
        id: 20,
        categoryId: 2,
        stockName: '저지방 우유',
        stockNum: 1,
        stockMinNum: 2,
        version: 0,
        lowStock: true,
        updatedAt: '2026-07-27T00:00:00Z',
      },
    ],
  },
]

interface HarnessProps {
  owned: boolean
  onDuty: boolean
  onError?: (message: string) => void
}

function Harness({ owned, onDuty, onError = vi.fn() }: HarnessProps) {
  const [stockCategories, setStockCategories] =
    useState<VevenoStockCategory[]>(categories)

  return (
    <VevenoStoreStocksPanel
      active
      storeId="store-1"
      owned={owned}
      onDuty={onDuty}
      stockCategories={stockCategories}
      setStockCategories={setStockCategories}
      onError={onError}
    />
  )
}

describe('VevenoStoreStocksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps off-duty staff in read-only mode and filters stock names', () => {
    render(<Harness owned={false} onDuty={false} />)

    expect(
      screen.getByText('근무 시간이 아니라 재고를 수정할 수 없습니다. 조회만 가능합니다.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ 재고 추가' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('검색'), {
      target: { value: '에티오피아' },
    })
    expect(screen.getByText('에티오피아')).toBeInTheDocument()
    expect(screen.queryByText('저지방 우유')).not.toBeInTheDocument()
  })

  it('updates stock quantity for an owner', async () => {
    const updated: VevenoStock = {
      ...categories[0].stocks[0],
      stockNum: 3,
      version: 1,
    }
    vi.mocked(vevenoApi.updateStock).mockResolvedValue({
      data: updated,
    } as AxiosResponse<VevenoStock>)

    const { container } = render(<Harness owned onDuty={false} />)
    fireEvent.click(within(container).getAllByRole('button', { name: '+' })[0])

    await waitFor(() => {
      expect(vevenoApi.updateStock).toHaveBeenCalledWith(10, {
        stockName: '에티오피아',
        stockNum: 3,
        stockMinNum: 1,
        version: 0,
      })
    })
    expect(within(container).getByText('3')).toBeInTheDocument()
  })

  it('refetches stocks on version conflict (409)', async () => {
    const onError = vi.fn()
    const conflict = Object.assign(new Error('Request failed with status code 409'), {
      isAxiosError: true as const,
      response: {
        status: 409,
        data: { message: '다른 사용자가 재고를 수정했습니다. 다시 불러온 뒤 수정하세요.' },
      },
      toJSON: () => ({}),
    })

    vi.mocked(vevenoApi.updateStock).mockRejectedValue(conflict)
    vi.mocked(vevenoApi.listStocks).mockResolvedValue({
      data: [
        {
          ...categories[0],
          stocks: [
            {
              ...categories[0].stocks[0],
              stockNum: 9,
              version: 2,
            },
          ],
        },
      ],
    } as AxiosResponse<VevenoStockCategory[]>)

    const { container } = render(<Harness owned onDuty={false} onError={onError} />)
    fireEvent.click(within(container).getAllByRole('button', { name: '+' })[0])

    await waitFor(() => {
      expect(vevenoApi.listStocks).toHaveBeenCalledWith('store-1')
      expect(within(container).getByText('9')).toBeInTheDocument()
      expect(onError).toHaveBeenCalled()
    })
    expect(String(onError.mock.calls[0][0])).toMatch(/다른 사용자가 재고를 수정/)
  })

  it('disables only the in-flight stock +/- buttons', async () => {
    let resolveUpdate: ((value: AxiosResponse<VevenoStock>) => void) | undefined
    vi.mocked(vevenoApi.updateStock).mockImplementation(
      () =>
        new Promise<AxiosResponse<VevenoStock>>((resolve) => {
          resolveUpdate = resolve
        }),
    )

    const { container } = render(<Harness owned onDuty={false} />)
    const plusButtons = within(container).getAllByRole('button', { name: '+' })
    const minusButtons = within(container).getAllByRole('button', { name: '−' })

    fireEvent.click(plusButtons[0])

    await waitFor(() => {
      expect(plusButtons[0]).toBeDisabled()
      expect(minusButtons[0]).toBeDisabled()
    })
    expect(plusButtons[1]).not.toBeDisabled()
    expect(minusButtons[1]).not.toBeDisabled()
    expect(vevenoApi.updateStock).toHaveBeenCalledTimes(1)

    fireEvent.click(plusButtons[0])
    expect(vevenoApi.updateStock).toHaveBeenCalledTimes(1)

    resolveUpdate?.({
      data: {
        ...categories[0].stocks[0],
        stockNum: 3,
        version: 1,
      },
    } as AxiosResponse<VevenoStock>)

    await waitFor(() => {
      expect(plusButtons[0]).not.toBeDisabled()
      expect(minusButtons[0]).not.toBeDisabled()
      expect(within(container).getByText('3')).toBeInTheDocument()
    })
  })
})
