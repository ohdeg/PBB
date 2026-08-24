import type { ApiMessageResponse } from '../../types/auth'
import type {
  VevenoCalendar,
  VevenoCalendarOccurrence,
  VevenoChecklistInput,
  VevenoChecklistTemplate,
  VevenoChecklistToday,
  VevenoCover,
  VevenoCreateCoverInput,
  VevenoJoinRequest,
  VevenoMenu,
  VevenoNotice,
  VevenoNoticeInput,
  VevenoRecipe,
  VevenoSchedule,
  VevenoScheduleReplaceMode,
  VevenoScheduleSlotInput,
  VevenoStock,
  VevenoStockCategory,
  VevenoStockLog,
  VevenoStore,
  VevenoSubscriber,
  VevenoTimerPreset,
  VevenoTimerPresetInput,
} from '../../types/veveno'
import { stringifyRecipeContents } from '../../types/veveno'
import {
  VEVENO_DEMO_OWNER_ID,
  VEVENO_DEMO_STAFF_ID,
  VEVENO_DEMO_STORE_ID,
  type VevenoDemoRole,
} from './vevenoDemo'

const STORAGE_KEY = 'veveno:demo:v4'
const CREATED = '2026-01-15T00:00:00.000Z'
const OWNER_NICK = '사장'
const STAFF_NICK = '민수'
const STAFF_JIHYE_ID = 'demo-staff-jihye'
const STAFF_TAEHO_ID = 'demo-staff-taeho'
const STAFF_HARIN_ID = 'demo-pending-harin'

interface DemoTemplate extends VevenoChecklistTemplate {
  createdBy: string
}

interface DemoStockLog extends VevenoStockLog {
  stockId: number
}

interface DemoState {
  role: VevenoDemoRole
  ids: Record<string, number>
  store: {
    name: string
    isPublic: boolean
    stockEditOffDuty: boolean
    stockUsageHint: boolean
    inviteCode: string
    createdAt: string
    updatedAt: string
  }
  menus: VevenoMenu[]
  recipes: VevenoRecipe[]
  notices: VevenoNotice[]
  categories: Omit<VevenoStockCategory, 'stocks'>[]
  stocks: VevenoStock[]
  logs: DemoStockLog[]
  subscribers: VevenoSubscriber[]
  joins: VevenoJoinRequest[]
  schedules: VevenoSchedule[]
  covers: VevenoCover[]
  checklists: DemoTemplate[]
  checks: Record<string, string>
  personalPresets: VevenoTimerPreset[]
  storePresets: VevenoTimerPreset[]
}

function ok<T>(data: T): Promise<{ data: T }> {
  return Promise.resolve({ data })
}

function nowIso(): string {
  return new Date().toISOString()
}

function recipe(title: string, notes: string): string {
  return stringifyRecipeContents({ title, notes })
}

function seedState(): DemoState {
  const sid = VEVENO_DEMO_STORE_ID
  return {
    role: 'owner',
    ids: {
      menu: 3,
      recipe: 3,
      notice: 1,
      stock: 3,
      category: 3,
      item: 6,
      log: 0,
      checklist: 2,
      schedule: 12,
      cover: 2,
      preset: 1,
    },
    store: {
      name: '베베노 카페',
      isPublic: false,
      stockEditOffDuty: false,
      stockUsageHint: false,
      inviteCode: 'DEMOCODE',
      createdAt: CREATED,
      updatedAt: CREATED,
    },
    menus: [
      { id: 'menu-1', storeId: sid, name: '아메리카노', createdAt: CREATED, updatedAt: CREATED },
      { id: 'menu-2', storeId: sid, name: '카페라떼', createdAt: CREATED, updatedAt: CREATED },
      { id: 'menu-3', storeId: sid, name: '버터 크로와상', createdAt: CREATED, updatedAt: CREATED },
    ],
    recipes: [
      {
        id: 'recipe-1',
        menuId: 'menu-1',
        contents: recipe('아메리카노', '에스프레소 더블 추출 후 물 200ml.'),
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: 'recipe-2',
        menuId: 'menu-2',
        contents: recipe('카페라떼', '에스프레소 위에 스팀 밀크. 하트 라떼아트.'),
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: 'recipe-3',
        menuId: 'menu-3',
        contents: recipe('버터 크로와상', '180도 예열, 8분. 겉이 노릇하면 꺼낸다.'),
        createdAt: CREATED,
        updatedAt: CREATED,
      },
    ],
    notices: [
      {
        id: 'notice-1',
        storeId: sid,
        authorUserId: VEVENO_DEMO_OWNER_ID,
        authorNickname: OWNER_NICK,
        title: '이번 주 원두 교체',
        body: '에티오피아로 바꿉니다. 산미가 조금 더 있어요.',
        createdAt: CREATED,
        updatedAt: CREATED,
      },
    ],
    categories: [
      { id: 1, storeId: sid, categoryName: '원두', createdAt: CREATED },
      { id: 2, storeId: sid, categoryName: '유제품', createdAt: CREATED },
      { id: 3, storeId: sid, categoryName: '소모품', createdAt: CREATED },
    ],
    stocks: [
      stockRow(1, 1, '에티오피아', 2, 1, '개', 'https://example.com/beans', true, 3),
      stockRow(2, 2, '우유', 4, 2, '개', null),
      stockRow(3, 3, '컵', 80, 20, '개', null),
    ],
    logs: [],
    subscribers: [
      subscriberRow(VEVENO_DEMO_STAFF_ID, 'minsu@demo.veveno', STAFF_NICK, true),
      subscriberRow(STAFF_JIHYE_ID, 'jihye@demo.veveno', '지혜', true),
      subscriberRow(STAFF_TAEHO_ID, 'taeho@demo.veveno', '태호', false),
    ],
    joins: [
      {
        userId: STAFF_HARIN_ID,
        email: 'harin@demo.veveno',
        nickname: '하린',
      },
    ],
    schedules: [
      scheduleRow('schedule-1', VEVENO_DEMO_STAFF_ID, STAFF_NICK, 1, '10:00', '19:00'),
      scheduleRow('schedule-2', VEVENO_DEMO_STAFF_ID, STAFF_NICK, 2, '09:00', '17:00'),
      scheduleRow('schedule-3', STAFF_JIHYE_ID, '지혜', 2, '11:00', '19:00'),
      scheduleRow('schedule-4', VEVENO_DEMO_STAFF_ID, STAFF_NICK, 3, '08:00', '16:00'),
      scheduleRow('schedule-5', STAFF_JIHYE_ID, '지혜', 3, '10:00', '18:00'),
      scheduleRow('schedule-6', STAFF_TAEHO_ID, '태호', 3, '12:00', '20:00'),
      scheduleRow('schedule-7', VEVENO_DEMO_STAFF_ID, STAFF_NICK, 4, '09:00', '15:00'),
      scheduleRow('schedule-8', STAFF_JIHYE_ID, '지혜', 4, '15:00', '21:00'),
      scheduleRow('schedule-9', STAFF_TAEHO_ID, '태호', 5, '08:00', '14:00'),
      scheduleRow('schedule-10', VEVENO_DEMO_STAFF_ID, STAFF_NICK, 5, '14:00', '21:00'),
      scheduleRow('schedule-11', VEVENO_DEMO_OWNER_ID, OWNER_NICK, 6, '09:00', '15:00'),
      scheduleRow('schedule-12', STAFF_JIHYE_ID, '지혜', 7, '11:00', '17:00'),
    ],
    covers: [
      coverRow({
        id: 'cover-1',
        originalUserId: VEVENO_DEMO_STAFF_ID,
        originalNickname: STAFF_NICK,
        coverUserId: null,
        coverNickname: '',
        workDate: weekYmd(1),
        startTime: '10:00',
        endTime: '19:00',
        shiftKind: 'COVER',
        initiatorType: 'EMPLOYEE',
        requestedByUserId: VEVENO_DEMO_STAFF_ID,
        status: 'PENDING_OWNER',
      }),
      coverRow({
        id: 'cover-2',
        originalUserId: STAFF_JIHYE_ID,
        originalNickname: '지혜',
        coverUserId: STAFF_TAEHO_ID,
        coverNickname: '태호',
        workDate: weekYmd(3),
        startTime: '10:00',
        endTime: '19:00',
        shiftKind: 'COVER',
        initiatorType: 'OWNER',
        requestedByUserId: VEVENO_DEMO_OWNER_ID,
        status: 'PENDING_COVER',
      }),
    ],
    checklists: [
      checklistRow(
        'checklist-1',
        '오픈',
        'CLOCK',
        '08:00',
        true,
        ['문 열기', '머신 예열', '재고 확인'],
        1,
      ),
      checklistRow(
        'checklist-2',
        '마감',
        'CLOCK',
        '21:00',
        false,
        ['머신 청소', '마감 정산', '문 잠금'],
        4,
      ),
    ],
    checks: {},
    personalPresets: [],
    storePresets: [
      {
        id: 'preset-1',
        scope: 'STORE',
        userId: null,
        storeId: sid,
        createdByUserId: VEVENO_DEMO_OWNER_ID,
        name: '에스프레소 추출',
        steps: [{ name: '추출', durationMs: 30_000 }],
        createdAt: CREATED,
        updatedAt: CREATED,
      },
    ],
  }
}

function stockRow(
  id: number,
  categoryId: number,
  stockName: string,
  stockNum: number,
  stockMinNum: number,
  unit: string,
  orderUrl: string | null,
  soonLow = false,
  daysOfStock: number | null = null,
): VevenoStock {
  return {
    id,
    categoryId,
    stockName,
    stockNum,
    stockMinNum,
    unit,
    orderUrl,
    version: 0,
    lowStock: stockNum <= stockMinNum,
    soonLow,
    daysOfStock,
    updatedAt: CREATED,
  }
}

function scheduleRow(
  id: string,
  userId: string,
  nickname: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): VevenoSchedule {
  return {
    id,
    storeId: VEVENO_DEMO_STORE_ID,
    userId,
    nickname,
    dayOfWeek,
    startTime,
    endTime,
    overnight: endTime < startTime,
  }
}

function subscriberRow(
  userId: string,
  email: string,
  nickname: string,
  canEditStock: boolean,
): VevenoSubscriber {
  return {
    userId,
    email,
    nickname,
    canEditStock,
    workStartDate: '2026-01-01',
    leaveDate: null,
    createdAt: CREATED,
  }
}

function seoulToday(): Date {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function weekYmd(isoDow: number): string {
  const today = seoulToday()
  const js = today.getDay()
  const todayIso = js === 0 ? 7 : js
  const next = new Date(today)
  next.setDate(today.getDate() + (isoDow - todayIso))
  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, '0')
  const d = String(next.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function coverRow(row: {
  id: string
  originalUserId: string | null
  originalNickname: string
  coverUserId: string | null
  coverNickname: string
  workDate: string
  startTime: string
  endTime: string
  shiftKind: VevenoCover['shiftKind']
  initiatorType: VevenoCover['initiatorType']
  requestedByUserId: string
  status: VevenoCover['status']
}): VevenoCover {
  return {
    storeId: VEVENO_DEMO_STORE_ID,
    overnight: row.endTime < row.startTime,
    note: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: CREATED,
    ...row,
  }
}

function checklistRow(
  id: string,
  title: string,
  triggerType: 'CLOCK',
  triggerTime: string,
  interrupt: boolean,
  bodies: string[],
  itemStart: number,
): DemoTemplate {
  return {
    id,
    storeId: VEVENO_DEMO_STORE_ID,
    personal: false,
    title,
    triggerType,
    triggerTime,
    triggerDows: [1, 2, 3, 4, 5, 6, 7],
    audience: 'ON_DUTY',
    interrupt,
    enabled: true,
    canEdit: true,
    createdBy: VEVENO_DEMO_OWNER_ID,
    items: bodies.map((body, i) => ({ id: itemStart + i, body })),
  }
}

let cache: DemoState | null = null

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* node test / blocked storage — memory cache still works */
  }
}

function loadState(): DemoState {
  try {
    const raw = readStored()
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState
      if (parsed?.store && parsed.menus && Array.isArray(parsed.joins)) {
        return parsed
      }
    }
  } catch {
    /* seed */
  }
  const seeded = seedState()
  writeStored(JSON.stringify(seeded))
  return seeded
}

function state(): DemoState {
  if (!cache) {
    cache = loadState()
  }
  return cache
}

function persist(): void {
  writeStored(JSON.stringify(state()))
}

function nextId(kind: string): string {
  const s = state()
  s.ids[kind] = (s.ids[kind] ?? 0) + 1
  return `${kind}-${s.ids[kind]}`
}

function nextNum(kind: string): number {
  const s = state()
  s.ids[kind] = (s.ids[kind] ?? 0) + 1
  return s.ids[kind]
}

function actor(): { userId: string; nickname: string } {
  return state().role === 'owner'
    ? { userId: VEVENO_DEMO_OWNER_ID, nickname: OWNER_NICK }
    : { userId: VEVENO_DEMO_STAFF_ID, nickname: STAFF_NICK }
}

function markStock(stock: VevenoStock): VevenoStock {
  const lowStock = stock.stockMinNum != null && stock.stockNum <= stock.stockMinNum
  return {
    ...stock,
    lowStock,
    soonLow: lowStock ? false : Boolean(stock.soonLow),
    daysOfStock: stock.daysOfStock,
  }
}

function viewStock(stock: VevenoStock): VevenoStock {
  const marked = markStock(stock)
  if (state().role === 'owner') {
    return marked
  }
  return { ...marked, orderUrl: null }
}

function categories(): VevenoStockCategory[] {
  const s = state()
  return s.categories.map((cat) => ({
    ...cat,
    stocks: s.stocks.filter((row) => row.categoryId === cat.id).map(viewStock),
  }))
}

function staffList(): { userId: string; nickname: string }[] {
  return [
    { userId: VEVENO_DEMO_OWNER_ID, nickname: OWNER_NICK },
    ...state().subscribers.map((row) => ({
      userId: row.userId,
      nickname: row.nickname,
    })),
  ]
}

function nickOf(userId: string): string {
  return staffList().find((row) => row.userId === userId)?.nickname ?? userId
}

function isoDow(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay()
  return js === 0 ? 7 : js
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = []
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const cur = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function viewChecklist(row: DemoTemplate): VevenoChecklistTemplate {
  const me = actor().userId
  return {
    ...row,
    canEdit: state().role === 'owner' || (row.personal && row.createdBy === me),
  }
}

function todayLists(): VevenoChecklistToday[] {
  const s = state()
  return s.checklists
    .filter((row) => row.enabled)
    .filter((row) => s.role === 'owner' || row.audience !== 'OWNER_ONLY')
    .map((row) => {
      const items = row.items.map((item) => {
        const by = s.checks[`${row.id}:${item.id}`]
        return {
          id: item.id,
          body: item.body,
          checked: Boolean(by),
          checkedByNickname: by ?? '',
        }
      })
      return {
        templateId: row.id,
        title: row.title,
        personal: row.personal,
        interrupt: row.interrupt,
        due: row.triggerType !== 'MANUAL',
        triggerType: row.triggerType,
        checkedCount: items.filter((item) => item.checked).length,
        totalCount: items.length,
        items,
      }
    })
}

export function applyDemoRole(role: VevenoDemoRole): VevenoStore {
  const owned = role === 'owner'
  const store = cache?.store ?? seedState().store
  return {
    id: VEVENO_DEMO_STORE_ID,
    ownerUserId: VEVENO_DEMO_OWNER_ID,
    name: store.name,
    isPublic: store.isPublic,
    inviteCode: owned ? store.inviteCode : null,
    owned,
    subscribed: !owned,
    canEditStock: true,
    onDuty: true,
    stockEditOffDuty: store.stockEditOffDuty,
    stockUsageHint: store.stockUsageHint,
    leaveDate: null,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  }
}

export function getDemoRole(): VevenoDemoRole {
  return state().role
}

export function setDemoRole(role: VevenoDemoRole): void {
  state().role = role
  persist()
}

export function resetVevenoDemo(): void {
  cache = seedState()
  persist()
}

export function currentDemoStore(): VevenoStore {
  return applyDemoRole(state().role)
}

export const vevenoDemoApi = {
  getStore(_storeId: string) {
    return ok(currentDemoStore())
  },

  updateStore(
    _storeId: string,
    payload: {
      name: string
      isPublic: boolean
      stockEditOffDuty: boolean
      stockUsageHint: boolean
    },
  ) {
    const s = state()
    s.store = { ...s.store, ...payload, updatedAt: nowIso() }
    persist()
    return ok(currentDemoStore())
  },

  regenerateInviteCode(_storeId: string) {
    const s = state()
    s.store.inviteCode = `DEMO${String(nextNum('invite')).padStart(4, '0')}`
    s.store.updatedAt = nowIso()
    persist()
    return ok(currentDemoStore())
  },

  deleteStore(_storeId: string) {
    resetVevenoDemo()
    return ok<ApiMessageResponse>({ message: '체험을 끝냈습니다.' })
  },

  listMenus(_storeId: string) {
    return ok([...state().menus])
  },

  createMenu(_storeId: string, name: string) {
    const at = nowIso()
    const menu: VevenoMenu = {
      id: nextId('menu'),
      storeId: VEVENO_DEMO_STORE_ID,
      name,
      createdAt: at,
      updatedAt: at,
    }
    state().menus.push(menu)
    persist()
    return ok(menu)
  },

  updateMenu(menuId: string, name: string) {
    const menu = state().menus.find((row) => row.id === menuId)
    if (!menu) {
      return Promise.reject(new Error('메뉴를 찾을 수 없습니다.'))
    }
    menu.name = name
    menu.updatedAt = nowIso()
    persist()
    return ok({ ...menu })
  },

  deleteMenu(menuId: string) {
    const s = state()
    s.menus = s.menus.filter((row) => row.id !== menuId)
    s.recipes = s.recipes.filter((row) => row.menuId !== menuId)
    persist()
    return ok<ApiMessageResponse>({ message: '삭제했습니다.' })
  },

  listNotices(_storeId: string) {
    return ok([...state().notices])
  },

  createNotice(_storeId: string, payload: VevenoNoticeInput) {
    const who = actor()
    const at = nowIso()
    const notice: VevenoNotice = {
      id: nextId('notice'),
      storeId: VEVENO_DEMO_STORE_ID,
      authorUserId: who.userId,
      authorNickname: who.nickname,
      title: payload.title,
      body: payload.body,
      createdAt: at,
      updatedAt: at,
    }
    state().notices.unshift(notice)
    persist()
    return ok(notice)
  },

  updateNotice(noticeId: string, payload: VevenoNoticeInput) {
    const notice = state().notices.find((row) => row.id === noticeId)
    if (!notice) {
      return Promise.reject(new Error('공지를 찾을 수 없습니다.'))
    }
    notice.title = payload.title
    notice.body = payload.body
    notice.updatedAt = nowIso()
    persist()
    return ok({ ...notice })
  },

  deleteNotice(noticeId: string) {
    const s = state()
    s.notices = s.notices.filter((row) => row.id !== noticeId)
    persist()
    return ok(undefined)
  },

  listRecipes(menuId: string) {
    return ok(state().recipes.filter((row) => row.menuId === menuId))
  },

  createRecipe(menuId: string, contents: string) {
    const at = nowIso()
    const recipeRow: VevenoRecipe = {
      id: nextId('recipe'),
      menuId,
      contents,
      createdAt: at,
      updatedAt: at,
    }
    state().recipes.push(recipeRow)
    persist()
    return ok(recipeRow)
  },

  updateRecipe(recipeId: string, contents: string) {
    const row = state().recipes.find((item) => item.id === recipeId)
    if (!row) {
      return Promise.reject(new Error('레시피를 찾을 수 없습니다.'))
    }
    row.contents = contents
    row.updatedAt = nowIso()
    persist()
    return ok({ ...row })
  },

  deleteRecipe(recipeId: string) {
    const s = state()
    s.recipes = s.recipes.filter((row) => row.id !== recipeId)
    persist()
    return ok<ApiMessageResponse>({ message: '삭제했습니다.' })
  },

  listStocks(_storeId: string) {
    return ok(categories())
  },

  createStockCategory(_storeId: string, name: string) {
    const cat: Omit<VevenoStockCategory, 'stocks'> = {
      id: nextNum('category'),
      storeId: VEVENO_DEMO_STORE_ID,
      categoryName: name,
      createdAt: nowIso(),
    }
    state().categories.push(cat)
    persist()
    return ok({ ...cat, stocks: [] })
  },

  updateStockCategory(categoryId: number, name: string) {
    const cat = state().categories.find((row) => row.id === categoryId)
    if (!cat) {
      return Promise.reject(new Error('분류를 찾을 수 없습니다.'))
    }
    cat.categoryName = name
    persist()
    return ok({ ...cat, stocks: state().stocks.filter((row) => row.categoryId === categoryId) })
  },

  deleteStockCategory(categoryId: number) {
    const s = state()
    const stockIds = new Set(s.stocks.filter((row) => row.categoryId === categoryId).map((row) => row.id))
    s.categories = s.categories.filter((row) => row.id !== categoryId)
    s.stocks = s.stocks.filter((row) => row.categoryId !== categoryId)
    s.logs = s.logs.filter((row) => !stockIds.has(row.stockId))
    persist()
    return ok<ApiMessageResponse>({ message: '삭제했습니다.' })
  },

  createStock(
    categoryId: number,
    payload: {
      stockName: string
      stockNum: number
      stockMinNum: number | null
      unit: string
      orderUrl: string | null
    },
  ) {
    const at = nowIso()
    const owner = state().role === 'owner'
    const row = markStock({
      id: nextNum('stock'),
      categoryId,
      stockName: payload.stockName,
      stockNum: payload.stockNum,
      stockMinNum: payload.stockMinNum,
      unit: payload.unit,
      orderUrl: owner ? payload.orderUrl : null,
      version: 0,
      lowStock: false,
      soonLow: false,
      daysOfStock: null,
      updatedAt: at,
    })
    state().stocks.push(row)
    if (payload.stockNum !== 0) {
      const who = actor()
      state().logs.unshift({
        id: nextNum('log'),
        stockId: row.id,
        fromNum: 0,
        toNum: payload.stockNum,
        nickname: who.nickname,
        createdAt: at,
      })
    }
    persist()
    return ok(viewStock(row))
  },

  updateStock(
    stockId: number,
    payload: {
      stockName: string
      stockNum: number
      stockMinNum: number | null
      version: number
      categoryId?: number
      unit?: string
      orderUrl?: string | null
    },
  ) {
    const row = state().stocks.find((item) => item.id === stockId)
    if (!row) {
      return Promise.reject(new Error('재고를 찾을 수 없습니다.'))
    }
    if (row.version !== payload.version) {
      return Promise.reject(new Error('다른 화면에서 재고가 바뀌었습니다. 다시 불러와 주세요.'))
    }
    const fromNum = row.stockNum
    row.stockName = payload.stockName
    row.stockNum = payload.stockNum
    row.stockMinNum = payload.stockMinNum
    if (payload.categoryId != null) {
      row.categoryId = payload.categoryId
    }
    if (payload.unit != null) {
      row.unit = payload.unit
    }
    if (payload.orderUrl !== undefined && state().role === 'owner') {
      row.orderUrl = payload.orderUrl
    }
    row.version += 1
    row.updatedAt = nowIso()
    if (fromNum !== payload.stockNum) {
      state().logs.unshift({
        id: nextNum('log'),
        stockId,
        fromNum,
        toNum: payload.stockNum,
        nickname: actor().nickname,
        createdAt: row.updatedAt,
      })
    }
    persist()
    return ok(viewStock({ ...row }))
  },

  deleteStock(stockId: number) {
    const s = state()
    s.stocks = s.stocks.filter((row) => row.id !== stockId)
    s.logs = s.logs.filter((row) => row.stockId !== stockId)
    persist()
    return ok<ApiMessageResponse>({ message: '삭제했습니다.' })
  },

  listStockLogs(_storeId: string, stockId: number) {
    return ok(
      state()
        .logs.filter((row) => row.stockId === stockId)
        .slice(0, 50)
        .map(({ stockId: _sid, ...log }) => log),
    )
  },

  requestJoin() {
    return ok<ApiMessageResponse>({ message: '체험 가게에는 가입할 수 없습니다.' })
  },

  listJoinRequests(_storeId: string) {
    return ok([...state().joins])
  },

  listSubscribers(_storeId: string) {
    return ok([...state().subscribers])
  },

  updateStockPermission(_storeId: string, userId: string, canEditStock: boolean) {
    const sub = state().subscribers.find((row) => row.userId === userId)
    if (!sub) {
      return Promise.reject(new Error('직원을 찾을 수 없습니다.'))
    }
    sub.canEditStock = canEditStock
    persist()
    return ok({ ...sub })
  },

  approveJoin(
    _storeId: string,
    userId: string,
    body: {
      canEditStock: boolean
      workStartDate: string | null
      slots: VevenoScheduleSlotInput[]
    },
  ) {
    const s = state()
    const join = s.joins.find((row) => row.userId === userId)
    if (!join) {
      return Promise.reject(new Error('가입 신청을 찾을 수 없습니다.'))
    }
    s.joins = s.joins.filter((row) => row.userId !== userId)
    s.subscribers.push({
      userId: join.userId,
      email: join.email,
      nickname: join.nickname,
      canEditStock: body.canEditStock,
      workStartDate: body.workStartDate,
      leaveDate: null,
      createdAt: nowIso(),
    })
    s.schedules.push(
      ...body.slots.map((slot) =>
        scheduleRow(
          nextId('schedule'),
          join.userId,
          join.nickname,
          slot.dayOfWeek,
          slot.startTime,
          slot.endTime,
        ),
      ),
    )
    persist()
    return ok<ApiMessageResponse>({ message: '가입을 승인했습니다.' })
  },

  rejectJoin(_storeId: string, userId: string) {
    const s = state()
    s.joins = s.joins.filter((row) => row.userId !== userId)
    persist()
    return ok<ApiMessageResponse>({ message: '가입을 거절했습니다.' })
  },

  resignSubscriber(_storeId: string, userId: string, leaveDate: string) {
    const sub = state().subscribers.find((row) => row.userId === userId)
    if (!sub) {
      return Promise.reject(new Error('직원을 찾을 수 없습니다.'))
    }
    sub.leaveDate = leaveDate
    persist()
    return ok({ ...sub })
  },

  clearSubscriberLeave(_storeId: string, userId: string) {
    const sub = state().subscribers.find((row) => row.userId === userId)
    if (!sub) {
      return Promise.reject(new Error('직원을 찾을 수 없습니다.'))
    }
    sub.leaveDate = null
    persist()
    return ok({ ...sub })
  },

  countCoversAfterLeave(_storeId: string, userId: string, leaveDate: string) {
    const count = state().covers.filter(
      (row) =>
        (row.originalUserId === userId || row.coverUserId === userId) &&
        row.workDate > leaveDate &&
        row.status === 'APPROVED',
    ).length
    return ok({ count })
  },

  listSchedules(_storeId: string) {
    return ok([...state().schedules])
  },

  listStaff(_storeId: string) {
    return ok(staffList())
  },

  replaceSchedules(
    _storeId: string,
    userId: string,
    payload: {
      slots: VevenoScheduleSlotInput[]
      mode: VevenoScheduleReplaceMode
      effectiveFrom?: string
    },
  ) {
    const s = state()
    // ponytail: demo ignores FROM_DATE/ONCE — weekly slots only. Real store uses server modes.
    s.schedules = [
      ...s.schedules.filter((row) => row.userId !== userId),
      ...payload.slots.map((slot) =>
        scheduleRow(nextId('schedule'), userId, nickOf(userId), slot.dayOfWeek, slot.startTime, slot.endTime),
      ),
    ]
    persist()
    return ok(s.schedules.filter((row) => row.userId === userId))
  },

  getCalendar(_storeId: string, from: string, to: string) {
    const s = state()
    const occurrences: VevenoCalendarOccurrence[] = []
    for (const date of eachDate(from, to)) {
      const dow = isoDow(date)
      for (const row of s.schedules) {
        if (row.dayOfWeek !== dow) continue
        occurrences.push({
          date,
          userId: row.userId,
          nickname: row.nickname,
          startTime: row.startTime,
          endTime: row.endTime,
          overnight: row.overnight,
          type: 'REGULAR',
          coverId: null,
          relatedUserId: null,
          relatedNickname: null,
        })
      }
      for (const cover of s.covers) {
        if (cover.workDate !== date || cover.status !== 'APPROVED' || !cover.coverUserId) {
          continue
        }
        occurrences.push({
          date,
          userId: cover.coverUserId,
          nickname: cover.coverNickname,
          startTime: cover.startTime,
          endTime: cover.endTime,
          overnight: cover.overnight,
          type: 'COVER',
          coverId: cover.id,
          relatedUserId: cover.originalUserId,
          relatedNickname: cover.originalNickname,
        })
        if (cover.originalUserId) {
          occurrences.push({
            date,
            userId: cover.originalUserId,
            nickname: cover.originalNickname,
            startTime: cover.startTime,
            endTime: cover.endTime,
            overnight: cover.overnight,
            type: 'COVERED_OUT',
            coverId: cover.id,
            relatedUserId: cover.coverUserId,
            relatedNickname: cover.coverNickname,
          })
        }
      }
    }
    return ok<VevenoCalendar>({
      from,
      to,
      schedules: [...s.schedules],
      covers: s.covers.filter((row) => row.workDate >= from && row.workDate <= to),
      occurrences,
    })
  },

  listPendingCovers(_storeId: string) {
    return ok(
      state().covers.filter(
        (row) => row.status === 'PENDING_OWNER' || row.status === 'PENDING_COVER',
      ),
    )
  },

  createCover(_storeId: string, payload: VevenoCreateCoverInput) {
    const who = actor()
    const originalUserId = payload.originalUserId ?? null
    const coverUserId = payload.coverUserId ?? null
    const owned = state().role === 'owner'
    const at = nowIso()
    const cover: VevenoCover = {
      id: nextId('cover'),
      storeId: VEVENO_DEMO_STORE_ID,
      originalUserId,
      originalNickname: originalUserId ? nickOf(originalUserId) : OWNER_NICK,
      coverUserId,
      coverNickname: coverUserId ? nickOf(coverUserId) : '',
      workDate: payload.workDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      overnight: payload.endTime < payload.startTime,
      shiftKind: payload.shiftKind ?? 'COVER',
      initiatorType: owned ? 'OWNER' : 'EMPLOYEE',
      requestedByUserId: who.userId,
      status: owned && coverUserId ? 'PENDING_COVER' : 'PENDING_OWNER',
      note: payload.note ?? null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: at,
    }
    state().covers.unshift(cover)
    persist()
    return ok(cover)
  },

  assignCover(coverId: string, coverUserId: string) {
    const cover = state().covers.find((row) => row.id === coverId)
    if (!cover) {
      return Promise.reject(new Error('대타를 찾을 수 없습니다.'))
    }
    cover.coverUserId = coverUserId
    cover.coverNickname = nickOf(coverUserId)
    cover.status = 'PENDING_COVER'
    persist()
    return ok({ ...cover })
  },

  acceptCover(coverId: string) {
    const cover = state().covers.find((row) => row.id === coverId)
    if (!cover) {
      return Promise.reject(new Error('대타를 찾을 수 없습니다.'))
    }
    cover.status = 'APPROVED'
    cover.decidedByUserId = actor().userId
    cover.decidedAt = nowIso()
    persist()
    return ok({ ...cover })
  },

  rejectCover(coverId: string) {
    const cover = state().covers.find((row) => row.id === coverId)
    if (!cover) {
      return Promise.reject(new Error('대타를 찾을 수 없습니다.'))
    }
    cover.status = 'REJECTED'
    cover.decidedByUserId = actor().userId
    cover.decidedAt = nowIso()
    persist()
    return ok({ ...cover })
  },

  cancelCover(coverId: string) {
    const cover = state().covers.find((row) => row.id === coverId)
    if (!cover) {
      return Promise.reject(new Error('대타를 찾을 수 없습니다.'))
    }
    cover.status = 'CANCELLED'
    persist()
    return ok({ ...cover })
  },

  listPersonalTimerPresets() {
    return ok([...state().personalPresets])
  },

  createPersonalTimerPreset(payload: VevenoTimerPresetInput) {
    const at = nowIso()
    const row: VevenoTimerPreset = {
      id: nextId('preset'),
      scope: 'PERSONAL',
      userId: actor().userId,
      storeId: null,
      createdByUserId: actor().userId,
      name: payload.name,
      steps: payload.steps,
      createdAt: at,
      updatedAt: at,
    }
    state().personalPresets.push(row)
    persist()
    return ok(row)
  },

  updatePersonalTimerPreset(presetId: string, payload: VevenoTimerPresetInput) {
    const row = state().personalPresets.find((item) => item.id === presetId)
    if (!row) {
      return Promise.reject(new Error('프리셋을 찾을 수 없습니다.'))
    }
    row.name = payload.name
    row.steps = payload.steps
    row.updatedAt = nowIso()
    persist()
    return ok({ ...row })
  },

  deletePersonalTimerPreset(presetId: string) {
    const s = state()
    s.personalPresets = s.personalPresets.filter((row) => row.id !== presetId)
    persist()
    return ok(undefined)
  },

  listStoreTimerPresets(_storeId: string) {
    return ok([...state().storePresets])
  },

  createStoreTimerPreset(storeId: string, payload: VevenoTimerPresetInput) {
    const at = nowIso()
    const row: VevenoTimerPreset = {
      id: nextId('preset'),
      scope: 'STORE',
      userId: null,
      storeId,
      createdByUserId: actor().userId,
      name: payload.name,
      steps: payload.steps,
      createdAt: at,
      updatedAt: at,
    }
    state().storePresets.push(row)
    persist()
    return ok(row)
  },

  updateStoreTimerPreset(
    _storeId: string,
    presetId: string,
    payload: VevenoTimerPresetInput,
  ) {
    const row = state().storePresets.find((item) => item.id === presetId)
    if (!row) {
      return Promise.reject(new Error('프리셋을 찾을 수 없습니다.'))
    }
    row.name = payload.name
    row.steps = payload.steps
    row.updatedAt = nowIso()
    persist()
    return ok({ ...row })
  },

  deleteStoreTimerPreset(_storeId: string, presetId: string) {
    const s = state()
    s.storePresets = s.storePresets.filter((row) => row.id !== presetId)
    persist()
    return ok(undefined)
  },

  listChecklists(_storeId: string) {
    const s = state()
    return ok(
      s.checklists
        .filter((row) => s.role === 'owner' || row.audience !== 'OWNER_ONLY')
        .map(viewChecklist),
    )
  },

  createChecklist(_storeId: string, payload: VevenoChecklistInput) {
    const row: DemoTemplate = {
      id: nextId('checklist'),
      storeId: VEVENO_DEMO_STORE_ID,
      personal: payload.personal,
      title: payload.title,
      triggerType: payload.triggerType,
      triggerTime: payload.triggerTime,
      triggerDows: payload.triggerDows,
      audience: payload.audience,
      interrupt: payload.interrupt,
      enabled: payload.enabled,
      canEdit: true,
      createdBy: actor().userId,
      items: payload.items.map((body) => ({ id: nextNum('item'), body })),
    }
    state().checklists.push(row)
    persist()
    return ok(viewChecklist(row))
  },

  updateChecklist(templateId: string, payload: VevenoChecklistInput) {
    const row = state().checklists.find((item) => item.id === templateId)
    if (!row) {
      return Promise.reject(new Error('할 일을 찾을 수 없습니다.'))
    }
    row.title = payload.title
    row.triggerType = payload.triggerType
    row.triggerTime = payload.triggerTime
    row.triggerDows = payload.triggerDows
    row.audience = payload.audience
    row.interrupt = payload.interrupt
    row.enabled = payload.enabled
    row.personal = payload.personal
    row.items = payload.items.map((body) => ({ id: nextNum('item'), body }))
    persist()
    return ok(viewChecklist(row))
  },

  deleteChecklist(templateId: string) {
    const s = state()
    s.checklists = s.checklists.filter((row) => row.id !== templateId)
    persist()
    return ok(undefined)
  },

  listTodayChecklists(_storeId: string) {
    return ok(todayLists())
  },

  openTodayChecklist(_storeId: string, _templateId: string) {
    return ok(todayLists())
  },

  setChecklistCheck(
    _storeId: string,
    templateId: string,
    payload: { itemId: number; checked: boolean },
  ) {
    const key = `${templateId}:${payload.itemId}`
    if (payload.checked) {
      state().checks[key] = actor().nickname
    } else {
      delete state().checks[key]
    }
    persist()
    return ok(todayLists())
  },
}
