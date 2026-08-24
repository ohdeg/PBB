// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vevenoApi } from '../../api/vevenoApi'
import type { VevenoStock, VevenoStockCategory, VevenoStockLog } from '../../types/veveno'
import { VevenoStoreStocksPanel, placeStock } from './VevenoStoreStocksPanel'

vi.mock('../../api/vevenoApi', () => ({
  vevenoApi: {
    createStockCategory: vi.fn(),
    updateStockCategory: vi.fn(),
    deleteStockCategory: vi.fn(),
    createStock: vi.fn(),
    updateStock: vi.fn(),
    deleteStock: vi.fn(),
    listStocks: vi.fn(),
    listStockLogs: vi.fn(),
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
        unit: '개',
        orderUrl: null,
        version: 0,
        lowStock: false,
        soonLow: false,
        daysOfStock: null,
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
        unit: '개',
        orderUrl: null,
        version: 0,
        lowStock: true,
        soonLow: false,
        daysOfStock: null,
        updatedAt: '2026-07-27T00:00:00Z',
      },
    ],
  },
]

interface HarnessProps {
  owned: boolean
  onDuty: boolean
  stockEditOffDuty?: boolean
  onError?: (message: string) => void
}

function Harness({
  owned,
  onDuty,
  stockEditOffDuty = false,
  onError = vi.fn(),
}: HarnessProps) {
  const [stockCategories, setStockCategories] =
    useState<VevenoStockCategory[]>(categories)

  return (
    <VevenoStoreStocksPanel
      active
      storeId="store-1"
      owned={owned}
      onDuty={onDuty}
      stockEditOffDuty={stockEditOffDuty}
      stockCategories={stockCategories}
      setStockCategories={setStockCategories}
      onError={onError}
    />
  )
}

describe('VevenoStoreStocksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(vevenoApi.listStockLogs).mockResolvedValue({
      data: [],
    } as AxiosResponse<VevenoStockLog[]>)
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps list order when quantity is updated in the same category', () => {
    const first = categories[0].stocks[0]
    const second: VevenoStock = { ...first, id: 11, stockName: '케냐', stockNum: 5 }
    const cats: VevenoStockCategory[] = [
      { ...categories[0], stocks: [first, second] },
    ]
    const next = placeStock(cats, { ...first, stockNum: 3, version: 1 })
    expect(next[0].stocks.map((s) => s.id)).toEqual([10, 11])
    expect(next[0].stocks[0].stockNum).toBe(3)
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

  it('lets off-duty staff mutate when stockEditOffDuty is on', () => {
    render(<Harness owned={false} onDuty={false} stockEditOffDuty />)

    expect(
      screen.queryByText('근무 시간이 아니라 재고를 수정할 수 없습니다. 조회만 가능합니다.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 재고 추가' })).toBeInTheDocument()
  })

  it('shows only low-stock items in the low tab', () => {
    render(<Harness owned onDuty={false} />)

    expect(screen.getByRole('tab', { name: /부족/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /부족/ }))

    expect(screen.getByText('부족 목록')).toBeInTheDocument()
    expect(screen.getByText('저지방 우유')).toBeInTheDocument()
    expect(screen.queryByText('에티오피아')).not.toBeInTheDocument()
  })

  it('lists soon-low stock in the low tab with remaining days', () => {
    function SoonHarness() {
      const [stockCategories, setStockCategories] = useState<VevenoStockCategory[]>([
        {
          ...categories[0],
          stocks: [{ ...categories[0].stocks[0], soonLow: true, daysOfStock: 4 }],
        },
      ])
      return (
        <VevenoStoreStocksPanel
          active
          storeId="store-1"
          owned
          onDuty={false}
          stockEditOffDuty={false}
          stockCategories={stockCategories}
          setStockCategories={setStockCategories}
          onError={vi.fn()}
        />
      )
    }

    render(<SoonHarness />)

    expect(screen.getByText(/약 4일분/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /부족/ }))
    expect(screen.getByText('에티오피아')).toBeInTheDocument()
    expect(screen.getByText('곧 부족 · 재고 확인')).toBeInTheDocument()
  })

  it('shows the order link only to owners', () => {
    function OrderHarness({ owned }: { owned: boolean }) {
      const [stockCategories, setStockCategories] = useState<VevenoStockCategory[]>([
        {
          ...categories[0],
          stocks: [{ ...categories[0].stocks[0], orderUrl: 'https://example.com/beans' }],
        },
      ])
      return (
        <VevenoStoreStocksPanel
          active
          storeId="store-1"
          owned={owned}
          onDuty
          stockEditOffDuty={false}
          stockCategories={stockCategories}
          setStockCategories={setStockCategories}
          onError={vi.fn()}
        />
      )
    }

    const { unmount } = render(<OrderHarness owned />)
    expect(screen.getByRole('link', { name: '발주' })).toHaveAttribute(
      'href',
      'https://example.com/beans',
    )
    unmount()

    render(<OrderHarness owned={false} />)
    expect(screen.queryByRole('link', { name: '발주' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ 재고 추가' }))
    expect(screen.queryByLabelText('발주 링크')).not.toBeInTheDocument()
  })

  it('omits orderUrl when staff save an edit', async () => {
    const updated: VevenoStock = {
      ...categories[0].stocks[0],
      stockNum: 3,
      version: 1,
    }
    vi.mocked(vevenoApi.updateStock).mockResolvedValue({
      data: updated,
    } as AxiosResponse<VevenoStock>)

    render(<Harness owned={false} onDuty />)
    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: '편집' }))
    expect(screen.queryByLabelText('발주 링크')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(vevenoApi.updateStock).toHaveBeenCalledWith(10, {
        stockName: '에티오피아',
        stockNum: 2,
        stockMinNum: 1,
        version: 0,
        categoryId: 1,
        unit: '개',
      })
    })
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
        categoryId: 1,
      })
    })
    expect(within(container).getByText('3개')).toBeInTheDocument()
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
      expect(within(container).getByText('9개')).toBeInTheDocument()
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
      expect(within(container).getByText('3개')).toBeInTheDocument()
    })
  })

  it('adds inbound quantity when the count is tapped', async () => {
    const updated: VevenoStock = {
      ...categories[0].stocks[0],
      stockNum: 12,
      version: 1,
    }
    vi.mocked(vevenoApi.updateStock).mockResolvedValue({
      data: updated,
    } as AxiosResponse<VevenoStock>)

    render(<Harness owned onDuty={false} />)
    fireEvent.click(screen.getByRole('button', { name: '에티오피아 입고, 현재 2개' }))
    fireEvent.change(screen.getByLabelText('입고 수량'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: '입고' }))

    await waitFor(() => {
      expect(vevenoApi.updateStock).toHaveBeenCalledWith(10, {
        stockName: '에티오피아',
        stockNum: 12,
        stockMinNum: 1,
        version: 0,
        categoryId: 1,
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '입고' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '에티오피아 입고, 현재 12개' })).toBeInTheDocument()
  })

  it('edits stock category, qty, name and min from the overflow menu', async () => {
    const updated: VevenoStock = {
      ...categories[0].stocks[0],
      categoryId: 2,
      stockName: '예가체프',
      stockNum: 8,
      stockMinNum: 4,
      version: 1,
    }
    vi.mocked(vevenoApi.updateStock).mockResolvedValue({
      data: updated,
    } as AxiosResponse<VevenoStock>)

    render(<Harness owned onDuty={false} />)
    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: '편집' }))
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('재고 이름'), { target: { value: '예가체프' } })
    fireEvent.change(screen.getByLabelText('수량'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('경고 수량'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(vevenoApi.updateStock).toHaveBeenCalledWith(10, {
        stockName: '예가체프',
        stockNum: 8,
        stockMinNum: 4,
        version: 0,
        categoryId: 2,
        unit: '개',
        orderUrl: null,
      })
    })
    expect(screen.getByText('예가체프')).toBeInTheDocument()
  })

  it('saves a custom unit typed like a custom category', async () => {
    const updated: VevenoStock = {
      ...categories[0].stocks[0],
      unit: '봉지',
      version: 1,
    }
    vi.mocked(vevenoApi.updateStock).mockResolvedValue({
      data: updated,
    } as AxiosResponse<VevenoStock>)

    render(<Harness owned onDuty={false} />)
    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: '편집' }))
    fireEvent.change(screen.getByLabelText('단위'), { target: { value: '__custom__' } })
    fireEvent.change(screen.getByLabelText('단위 이름'), { target: { value: '봉지' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(vevenoApi.updateStock).toHaveBeenCalledWith(10, {
        stockName: '에티오피아',
        stockNum: 2,
        stockMinNum: 1,
        version: 0,
        categoryId: 1,
        unit: '봉지',
        orderUrl: null,
      })
    })
  })

  it('shows quantity logs in the edit modal', async () => {
    vi.mocked(vevenoApi.listStockLogs).mockResolvedValue({
      data: [
        {
          id: 1,
          fromNum: 10,
          toNum: 9,
          nickname: '민수',
          createdAt: '2026-08-22T05:03:00Z',
        },
      ],
    } as AxiosResponse<VevenoStockLog[]>)

    render(<Harness owned onDuty={false} />)
    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: '편집' }))

    await waitFor(() => {
      expect(vevenoApi.listStockLogs).toHaveBeenCalledWith('store-1', 10)
      expect(screen.getByText(/민수 · 10→9/)).toBeInTheDocument()
    })
  })

  it('deletes a stock from the overflow menu', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(vevenoApi.deleteStock).mockResolvedValue({
      data: { message: 'ok' },
    } as AxiosResponse<{ message: string }>)

    render(<Harness owned onDuty={false} />)
    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    fireEvent.click(screen.getAllByRole('button', { name: '더보기' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))

    await waitFor(() => {
      expect(vevenoApi.deleteStock).toHaveBeenCalledWith(10)
    })
    expect(screen.queryByText('에티오피아')).not.toBeInTheDocument()
    confirm.mockRestore()
  })
})
