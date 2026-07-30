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
  leaveDate: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface VevenoStock {
  id: number;
  categoryId: number;
  stockName: string;
  stockNum: number;
  stockMinNum: number | null;
  lowStock: boolean;
  updatedAt: string;
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
