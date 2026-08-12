export type SrankoFit = 'slim' | 'regular' | 'loose';

export const SRANKO_FIT_LABEL: Record<SrankoFit, string> = {
  slim: '슬림',
  regular: '보통',
  loose: '여유',
};

/** Per-part fit band from fit-check `parts` (unknown → cm values are null). */
export type SrankoFitBand = 'small' | 'ok' | 'large' | 'unknown';

/** One garment-vs-body comparison for the try-on fit map. */
export interface SrankoFitPart {
  key: string;
  bodyCm: number | null;
  garmentCm: number | null;
  deltaCm: number | null;
  band: SrankoFitBand;
}

export type SrankoSlot =
  | 'TOP'
  | 'BOTTOM'
  | 'OUTER'
  | 'SHOES'
  | 'DRESS'
  | 'BAG'
  | 'HAT'
  | 'JEWELRY';

/** Slots that never use warmth (shoes + accessories). */
export type SrankoWarmthlessSlot = 'SHOES' | 'BAG' | 'HAT' | 'JEWELRY';

export type SrankoWornGarmentSlot = Exclude<SrankoSlot, SrankoWarmthlessSlot>;

export const SRANKO_WARMTHLESS_SLOTS: readonly SrankoWarmthlessSlot[] = [
  'SHOES',
  'BAG',
  'HAT',
  'JEWELRY',
] as const;

export function isWarmthlessSlot(slot: SrankoSlot): boolean {
  return (SRANKO_WARMTHLESS_SLOTS as readonly string[]).includes(slot);
}

export const SRANKO_WORN_GARMENT_SLOTS: readonly SrankoWornGarmentSlot[] = [
  'TOP',
  'BOTTOM',
  'OUTER',
  'DRESS',
] as const;

/** Slots allowed in look try-on (worn garments + hat + shoes). */
export const SRANKO_LOOK_TRY_ON_SLOTS: readonly SrankoSlot[] = [
  ...SRANKO_WORN_GARMENT_SLOTS,
  'HAT',
  'SHOES',
] as const;

export function isLookTryOnSlot(slot: SrankoSlot): boolean {
  return (SRANKO_LOOK_TRY_ON_SLOTS as readonly string[]).includes(slot);
}

export interface SrankoItem {
  id: string;
  slot: SrankoSlot;
  categoryCode: string;
  /** Warmth 1–5; null for shoes/accessories / unset. User-confirmed = future training GT. */
  warmth: number | null;
  name: string;
  imageUrl: string;
  measurements: Record<string, string>;
  createdAt: string;
}

export interface SrankoLook {
  id: string;
  name: string;
  imageUrl: string;
  itemIds: string[];
  source: 'COMPOSE' | 'TRY_ON';
  createdAt: string;
}

export interface SrankoPost {
  id: string;
  subject: string;
  content: string;
  imageUrl: string;
  imageUrls: string[];
  authorNickname: string;
  authorUserId: string;
  readCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  viewCounted: boolean | null;
  createdAt: string;
}

export interface SrankoComment {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  authorNickname: string;
  authorUserId: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface SrankoPlace {
  id: string;
  label: string;
  kind: 'HOME' | 'WORK' | 'FAVORITE';
  lat: number;
  lon: number;
  query: string | null;
}

export interface SrankoPlaceSearchHit {
  name: string;
  region: string | null;
  country: string | null;
  lat: number;
  lon: number;
}

export interface SrankoUserPrefs {
  tryOnConsent: boolean;
  /** M | F; null/unset → male mannequin fallback. */
  sex: 'M' | 'F' | null;
  bodyMeasurements: Record<string, string>;
  places: SrankoPlace[];
}

export interface SrankoWeatherHourly {
  time: string;
  condition: string | null;
  conditionCode: number | null;
  tempC: number;
  chanceOfRain: number | null;
}

export interface SrankoWeather {
  condition: string | null;
  conditionCode: number | null;
  tempC: number;
  humidity: number | null;
  windKph: number | null;
  cached: boolean;
  manualTemp: boolean;
  hourly: SrankoWeatherHourly[];
}

export const SRANKO_SLOTS: readonly SrankoSlot[] = [
  'TOP',
  'BOTTOM',
  'OUTER',
  'SHOES',
  'DRESS',
  'BAG',
  'HAT',
  'JEWELRY',
] as const;

export const SRANKO_CATEGORIES: Record<SrankoSlot, readonly string[]> = {
  TOP: ['민소매', '반팔', '긴팔', '셔츠', '후드', '맨투맨', '니트'],
  BOTTOM: ['반바지', '데님', '면바지', '슬랙스', '치마'],
  OUTER: ['자켓', '코트', '패딩', '외투'],
  SHOES: ['캐주얼', '운동화', '드레스슈즈', '부츠'],
  /** Sleeve style for dresses (slot already means 원피스). Legacy `원피스` → treat as 긴팔. */
  DRESS: ['긴팔', '반팔', '민소매'],
  BAG: ['토트', '숄더', '크로스', '백팩', '클러치'],
  HAT: ['캡', '비니', '버킷', '기타'],
  JEWELRY: ['목걸이', '귀걸이', '반지', '팔찌', '기타'],
};

export const SLOT_LABEL: Record<SrankoSlot, string> = {
  TOP: '상의',
  BOTTOM: '하의',
  OUTER: '아우터',
  SHOES: '신발',
  DRESS: '원피스',
  BAG: '가방',
  HAT: '모자',
  JEWELRY: '주얼리',
};

/** Normalize legacy DRESS category `원피스` → `긴팔`. */
export function normalizeSrankoCategoryCode(
  slot: SrankoSlot,
  categoryCode: string,
): string {
  const options = SRANKO_CATEGORIES[slot];
  if (slot === 'DRESS' && (categoryCode === '원피스' || !options.includes(categoryCode))) {
    return '긴팔';
  }
  return options.includes(categoryCode) ? categoryCode : options[0];
}

/** Subcategory label (DRESS = sleeve style; legacy `원피스` → `긴팔`). */
export function formatSrankoCategoryLabel(
  slot: SrankoSlot,
  categoryCode: string,
): string {
  if (slot === 'DRESS') {
    return normalizeSrankoCategoryCode(slot, categoryCode);
  }
  return categoryCode;
}

/** Warmth options for ITEM+ (1 cool … 5 warm). */
export const SRANKO_WARMTH_OPTIONS: readonly number[] = [1, 2, 3, 4, 5] as const;
