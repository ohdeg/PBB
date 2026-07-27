// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { brewApi } from '../../api/brewApi'
import type { BrewStock, BrewStockCategory } from '../../types/brew'
import { VevenoStoreStocksPanel } from './VevenoStoreStocksPanel'

vi.mock('../../api/brewApi', () => ({
  brewApi: {
    createStockCategory: vi.fn(),
    updateStockCategory: vi.fn(),
    deleteStockCategory: vi.fn(),
    createStock: vi.fn(),
    updateStock: vi.fn(),
  },
}))

const categories: BrewStockCategory[] = [
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
        lowStock: true,
        updatedAt: '2026-07-27T00:00:00Z',
      },
    ],
  },
]

interface HarnessProps {
  owned: boolean
  onDuty: boolean
}

function Harness({ owned, onDuty }: HarnessProps) {
  const [stockCategories, setStockCategories] =
    useState<BrewStockCategory[]>(categories)

  return (
    <VevenoStoreStocksPanel
      active
      storeId="store-1"
      owned={owned}
      onDuty={onDuty}
      stockCategories={stockCategories}
      setStockCategories={setStockCategories}
      onError={vi.fn()}
    />
  )
}

describe('VevenoStoreStocksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const updated: BrewStock = {
      ...categories[0].stocks[0],
      stockNum: 3,
    }
    vi.mocked(brewApi.updateStock).mockResolvedValue({
      data: updated,
    } as AxiosResponse<BrewStock>)

    render(<Harness owned onDuty={false} />)
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0])

    await waitFor(() => {
      expect(brewApi.updateStock).toHaveBeenCalledWith(10, {
        stockName: '에티오피아',
        stockNum: 3,
        stockMinNum: 1,
      })
    })
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
