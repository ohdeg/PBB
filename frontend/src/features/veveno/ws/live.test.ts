import { describe, expect, it } from 'vitest'
import type { VevenoNotice, VevenoStockCheck } from '../../../types/veveno'
import { applyWsEvent, resetVevenoWsLive } from './live'

function check(ids: number[]): VevenoStockCheck {
  return {
    requestId: 'r1',
    updatedAt: '2026-09-04T00:00:00.000Z',
    items: ids.map((id) => ({
      id,
      categoryId: 1,
      name: `s${id}`,
      qty: 1,
      stockMinNum: 0,
      unit: '개',
      version: 0,
    })),
  }
}

const notice: VevenoNotice = {
  id: 'n1',
  storeId: 'a',
  authorUserId: 'u',
  authorNickname: 'boss',
  title: '휴무',
  body: '내일 쉽니다',
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
}

describe('veveno ws live', () => {
  it('hello then added item alerts pos', () => {
    resetVevenoWsLive()
    applyWsEvent({
      topic: 'hello',
      kind: 'snapshot',
      stores: [{ storeId: 'a', storeName: 'A', open: check([1]), done: null, notices: [] }],
    })
    expect(applyWsEvent({
      topic: 'stockCheck',
      kind: 'open',
      storeId: 'a',
      storeName: 'A',
      open: check([1, 2]),
      done: null,
    })).toBe('posOpen')
  })

  it('complete alerts owner once', () => {
    resetVevenoWsLive()
    applyWsEvent({
      topic: 'hello',
      kind: 'snapshot',
      stores: [{ storeId: 'a', storeName: 'A', open: check([1]), done: null, notices: [] }],
    })
    expect(applyWsEvent({
      topic: 'stockCheck',
      kind: 'done',
      storeId: 'a',
      storeName: 'A',
      open: null,
      done: { ...check([1]), requestId: 'r1' },
    })).toBe('ownerDone')
  })

  it('notice create prepends', () => {
    resetVevenoWsLive()
    applyWsEvent({
      topic: 'hello',
      kind: 'snapshot',
      stores: [{ storeId: 'a', storeName: 'A', open: null, done: null, notices: [] }],
    })
    expect(applyWsEvent({
      topic: 'notice',
      kind: 'created',
      storeId: 'a',
      notice,
    })).toBe('noticeCreated')
  })
})
