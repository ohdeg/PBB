export interface BrewStore {
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

export interface BrewMenu {
  id: string;
  storeId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrewRecipeContent {
  title: string;
  notes: string;
}

export interface BrewRecipe {
  id: string;
  menuId: string;
  contents: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrewStock {
  id: number;
  categoryId: number;
  stockName: string;
  stockNum: number;
  stockMinNum: number | null;
  lowStock: boolean;
  updatedAt: string;
}

export interface BrewStockCategory {
  id: number;
  storeId: string;
  categoryName: string;
  stocks: BrewStock[];
  createdAt: string;
}

export interface BrewJoinRequest {
  userId: string;
  email: string;
  nickname: string;
}

export interface BrewSubscriber {
  userId: string;
  email: string;
  nickname: string;
  canEditStock: boolean;
  workStartDate: string | null;
  leaveDate: string | null;
  createdAt: string;
}

export type BrewCoverStatus =
  | 'PENDING_OWNER'
  | 'PENDING_COVER'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type BrewCoverInitiator = 'EMPLOYEE' | 'OWNER';

export type BrewOccurrenceType = 'REGULAR' | 'COVER' | 'COVERED_OUT' | 'EXTRA';

export type BrewShiftKind = 'COVER' | 'EXTRA';

export interface BrewSchedule {
  id: string;
  storeId: string;
  userId: string;
  nickname: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  overnight: boolean;
}

export interface BrewCover {
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
  shiftKind: BrewShiftKind;
  initiatorType: BrewCoverInitiator;
  requestedByUserId: string;
  status: BrewCoverStatus;
  note: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface BrewNotice {
  id: string;
  storeId: string;
  authorUserId: string;
  authorNickname: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrewNoticeInput {
  title: string;
  body: string;
}

export interface BrewCalendarOccurrence {
  date: string;
  userId: string;
  nickname: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  type: BrewOccurrenceType;
  coverId: string | null;
  relatedUserId: string | null;
  relatedNickname: string | null;
}

export interface BrewCalendar {
  from: string;
  to: string;
  schedules: BrewSchedule[];
  covers: BrewCover[];
  occurrences: BrewCalendarOccurrence[];
}

export interface BrewScheduleSlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface BrewCreateCoverInput {
  originalUserId?: string;
  coverUserId?: string;
  workDate: string;
  startTime: string;
  endTime: string;
  shiftKind?: BrewShiftKind;
  note?: string;
}

export type BrewTimerPresetScope = 'PERSONAL' | 'STORE';

export interface BrewTimerPresetStep {
  name: string;
  durationMs: number;
}

export interface BrewTimerPreset {
  id: string;
  scope: BrewTimerPresetScope;
  userId: string | null;
  storeId: string | null;
  createdByUserId: string;
  name: string;
  steps: BrewTimerPresetStep[];
  createdAt: string;
  updatedAt: string;
}

export interface BrewTimerPresetInput {
  name: string;
  steps: BrewTimerPresetStep[];
}

export function parseRecipeContents(raw: string): BrewRecipeContent {
  try {
    const parsed = JSON.parse(raw) as Partial<BrewRecipeContent> & {
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

export function stringifyRecipeContents(content: BrewRecipeContent): string {
  return JSON.stringify({
    title: content.title.trim(),
    notes: content.notes,
  });
}

export const EMPTY_RECIPE_CONTENT: BrewRecipeContent = {
  title: '',
  notes: '',
};
