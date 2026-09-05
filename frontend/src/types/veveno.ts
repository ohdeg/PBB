export interface VevenoStore {
  id: string;
  ownerUserId: string;
  name: string;
  isPublic: boolean;
  /** owner에게만 내려옴 */
  inviteCode: string | null;
  owned: boolean;
  subscribed: boolean;
  canEditStock: boolean;
  onDuty: boolean;
  /** 1이면 재고권한 직원이 근무 외에도 수정 가능. 기본 false */
  stockEditOffDuty: boolean;
  /** 1이면 사용량으로 재고 일수·곧 부족 안내. 기본 false */
  stockUsageHint: boolean;
  /** 호출벨 멘트. 없으면 번호만 */
  callBellPhrase: string | null;
  callBellRate: number | null;
  callBellPitch: number | null;
  leaveDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VevenoStats {
  ownerCount: number;
  storeCount: number;
}

export interface VevenoMenu {
  id: string;
  storeId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface VevenoRecipeContent {
  title: string;
  notes: string;
}

export interface VevenoRecipe {
  id: string;
  menuId: string;
  contents: string;
  createdAt: string;
  updatedAt: string;
}

export const VEVENO_STOCK_UNITS = ['개', 'g', 'kg', 'ml', 'L', '팩', '박스'] as const;
export type VevenoStockUnit = (typeof VEVENO_STOCK_UNITS)[number];

export interface VevenoStock {
  id: number;
  categoryId: number;
  stockName: string;
  stockNum: number;
  stockMinNum: number | null;
  unit: string;
  orderUrl: string | null;
  /** JPA @Version — PATCH 시 필수 */
  version: number;
  lowStock: boolean;
  soonLow: boolean;
  daysOfStock: number | null;
  updatedAt: string;
}

export interface VevenoStockLog {
  id: number;
  fromNum: number;
  toNum: number;
  nickname: string;
  createdAt: string;
}

export interface VevenoStockCategory {
  id: number;
  storeId: string;
  categoryName: string;
  stocks: VevenoStock[];
  createdAt: string;
}

export interface VevenoJoinRequest {
  userId: string;
  email: string;
  nickname: string;
}

export interface VevenoLeaveCoverPreview {
  count: number;
  convert: number;
  delete: number;
  keep: number;
}

export interface VevenoSubscriber {
  userId: string;
  email: string;
  nickname: string;
  canEditStock: boolean;
  workStartDate: string | null;
  leaveDate: string | null;
  createdAt: string;
}

export type VevenoCoverStatus =
  | 'PENDING_OWNER'
  | 'PENDING_COVER'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type VevenoCoverInitiator = 'EMPLOYEE' | 'OWNER';

export type VevenoOccurrenceType = 'REGULAR' | 'COVER' | 'COVERED_OUT' | 'EXTRA';

export type VevenoShiftKind = 'COVER' | 'EXTRA';

export interface VevenoSchedule {
  id: string;
  storeId: string;
  userId: string;
  nickname: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  overnight: boolean;
}

export interface VevenoCover {
  id: string;
  storeId: string;
  originalUserId: string | null;
  originalNickname: string;
  coverUserId: string | null;
  coverNickname: string;
  workDate: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  shiftKind: VevenoShiftKind;
  initiatorType: VevenoCoverInitiator;
  requestedByUserId: string;
  status: VevenoCoverStatus;
  note: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface VevenoNotice {
  id: string;
  storeId: string;
  authorUserId: string;
  authorNickname: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface VevenoNoticeInput {
  title: string;
  body: string;
}

export interface VevenoCalendarOccurrence {
  date: string;
  userId: string;
  nickname: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  type: VevenoOccurrenceType;
  coverId: string | null;
  relatedUserId: string | null;
  relatedNickname: string | null;
}

export interface VevenoCalendar {
  from: string;
  to: string;
  schedules: VevenoSchedule[];
  covers: VevenoCover[];
  occurrences: VevenoCalendarOccurrence[];
}

export interface VevenoScheduleSlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export type VevenoScheduleReplaceMode = 'FROM_TODAY' | 'FROM_DATE' | 'ONCE';

export interface VevenoCreateCoverInput {
  originalUserId?: string;
  coverUserId?: string;
  workDate: string;
  startTime: string;
  endTime: string;
  shiftKind?: VevenoShiftKind;
  note?: string;
}

export type VevenoTimerPresetScope = 'PERSONAL' | 'STORE';

export interface VevenoTimerPresetStep {
  name: string;
  durationMs: number;
}

export interface VevenoTimerPreset {
  id: string;
  scope: VevenoTimerPresetScope;
  userId: string | null;
  storeId: string | null;
  createdByUserId: string;
  name: string;
  steps: VevenoTimerPresetStep[];
  createdAt: string;
  updatedAt: string;
}

export interface VevenoTimerPresetInput {
  name: string;
  steps: VevenoTimerPresetStep[];
}

export type VevenoChecklistTrigger = 'CLOCK' | 'SHIFT_START' | 'SHIFT_END' | 'MANUAL';
export type VevenoChecklistAudience = 'ON_DUTY' | 'OWNER_ONLY';

export interface VevenoChecklistItem {
  id: number;
  body: string;
}

export interface VevenoChecklistTemplate {
  id: string;
  storeId: string;
  personal: boolean;
  title: string;
  triggerType: VevenoChecklistTrigger;
  triggerTime: string | null;
  triggerDows: number[];
  audience: VevenoChecklistAudience;
  interrupt: boolean;
  enabled: boolean;
  canEdit: boolean;
  items: VevenoChecklistItem[];
}

export interface VevenoChecklistTodayItem {
  id: number;
  body: string;
  checked: boolean;
  checkedByNickname: string;
}

export interface VevenoChecklistToday {
  templateId: string;
  title: string;
  personal: boolean;
  interrupt: boolean;
  due: boolean;
  triggerType: VevenoChecklistTrigger;
  checkedCount: number;
  totalCount: number;
  items: VevenoChecklistTodayItem[];
}

export interface VevenoChecklistInput {
  title: string;
  triggerType: VevenoChecklistTrigger;
  triggerTime: string | null;
  triggerDows: number[];
  audience: VevenoChecklistAudience;
  interrupt: boolean;
  enabled: boolean;
  personal: boolean;
  items: string[];
}

export function parseRecipeContents(raw: string): VevenoRecipeContent {
  try {
    const parsed = JSON.parse(raw) as Partial<VevenoRecipeContent> & {
      method?: string;
      notes?: string;
    };
    return {
      title: parsed.title ?? '',
      notes: parsed.notes ?? '',
    };
  } catch {
    return {
      title: '',
      notes: raw,
    };
  }
}

export function stringifyRecipeContents(content: VevenoRecipeContent): string {
  return JSON.stringify({
    title: content.title.trim(),
    notes: content.notes,
  });
}

export const EMPTY_RECIPE_CONTENT: VevenoRecipeContent = {
  title: '',
  notes: '',
};

export interface VevenoStockCheckItem {
  id: number;
  categoryId: number;
  name: string;
  qty: number;
  stockMinNum: number | null;
  unit: string;
  version: number;
}

/** ponytail: WS payload == REST GET current/done */
export interface VevenoStockCheck {
  requestId: string;
  updatedAt: string;
  items: VevenoStockCheckItem[];
}

export interface VevenoWsStoreSnapshot {
  storeId: string;
  storeName: string;
  open: VevenoStockCheck | null;
  done: VevenoStockCheck | null;
  notices: VevenoNotice[];
}

export interface VevenoWsEvent {
  topic: 'hello' | 'stockCheck' | 'notice';
  kind: string;
  storeId?: string | null;
  storeName?: string | null;
  open?: VevenoStockCheck | null;
  done?: VevenoStockCheck | null;
  notices?: VevenoNotice[] | null;
  notice?: VevenoNotice | null;
  noticeId?: string | null;
  stores?: VevenoWsStoreSnapshot[] | null;
}

export interface VevenoPosPair {
  pairId: string;
  secret: string;
  payload: string;
  expiresAt: string;
  storeId: string | null;
}

export interface VevenoPosPoll {
  status: 'pending' | 'ready';
  pairId: string | null;
}

export interface VevenoPosToken {
  accessToken: string;
  storeId: string;
  canEditStock: boolean;
  expiresAt: string;
  deviceId: string;
}

export interface VevenoPosMe {
  storeId: string;
  canEditStock: boolean;
  expiresAt: string;
  deviceId: string;
}

export interface VevenoPosDevice {
  id: string;
  deviceId: string;
  enrolledByNickname: string;
  createdAt: string;
}
