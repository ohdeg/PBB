import type { SrankoSlot } from './types';

/** Length input unit (stored as cm). */
export type LengthUnit = 'cm' | 'inch';

/** Weight input unit (stored as kg). */
export type WeightUnit = 'kg' | 'lb';

/** Shoe input unit (stored as mm). */
export type ShoeUnit = 'mm' | 'eu' | 'us';

/**
 * Item girth input: clothing tags often list 단면 (flat).
 * Always persist circumference (cm) in measurements_json.
 * Legacy items may already store flat values as if circ — no auto-migration.
 */
export type GirthInputMode = 'flat' | 'circ';

export type MeasurementKind = 'length' | 'weight' | 'shoe';

export interface MeasurementFieldDef {
  key: string;
  label: string;
  kind: MeasurementKind;
}

/** Girth keys: ×2 when item input mode is 단면 (flat). Never for shoulder/lengths/etc. */
export const ITEM_GIRTH_KEYS = new Set([
  'chest',
  'waist',
  'hip',
  'thigh',
  'thighCircumference',
]);

export function isItemGirthKey(key: string): boolean {
  return ITEM_GIRTH_KEYS.has(key);
}

export const BODY_MEASUREMENT_FIELDS: readonly MeasurementFieldDef[] = [
  { key: 'height', label: '키', kind: 'length' },
  { key: 'weight', label: '몸무게', kind: 'weight' },
  { key: 'shoulder', label: '어깨', kind: 'length' },
  { key: 'chest', label: '가슴 (둘레)', kind: 'length' },
  { key: 'armLength', label: '팔길이', kind: 'length' },
  { key: 'armCircumference', label: '팔 둘레', kind: 'length' },
  { key: 'torsoLength', label: '상체 총장', kind: 'length' },
  { key: 'waist', label: '허리 (둘레)', kind: 'length' },
  { key: 'hip', label: '엉덩이 (둘레)', kind: 'length' },
  { key: 'inseam', label: '인심', kind: 'length' },
  { key: 'thighCircumference', label: '허벅지 둘레', kind: 'length' },
  { key: 'legLength', label: '하체 총장', kind: 'length' },
  { key: 'shoeSize', label: '발 사이즈', kind: 'shoe' },
] as const;

export interface BodyMeasurementSection {
  id: string;
  title: string;
  fields: readonly MeasurementFieldDef[];
}

/** 「내 사이즈」 모달 세션 구분 (키·몸무게 / 상체 / 하체). */
export const BODY_MEASUREMENT_SECTIONS: readonly BodyMeasurementSection[] = [
  {
    id: 'basics',
    title: '키·몸무게',
    fields: BODY_MEASUREMENT_FIELDS.filter(
      (f) => f.key === 'height' || f.key === 'weight',
    ),
  },
  {
    id: 'upper',
    title: '상체',
    fields: BODY_MEASUREMENT_FIELDS.filter((f) =>
      ['shoulder', 'chest', 'armLength', 'armCircumference', 'torsoLength'].includes(
        f.key,
      ),
    ),
  },
  {
    id: 'lower',
    title: '하체',
    fields: BODY_MEASUREMENT_FIELDS.filter((f) =>
      [
        'waist',
        'hip',
        'inseam',
        'thighCircumference',
        'legLength',
        'shoeSize',
      ].includes(f.key),
    ),
  },
] as const;

export const ITEM_MEASUREMENT_FIELDS: Record<
  SrankoSlot,
  readonly MeasurementFieldDef[]
> = {
  TOP: [
    { key: 'shoulder', label: '어깨', kind: 'length' },
    { key: 'chest', label: '가슴', kind: 'length' },
    { key: 'armLength', label: '팔길이', kind: 'length' },
    { key: 'totalLength', label: '총기장', kind: 'length' },
  ],
  OUTER: [
    { key: 'shoulder', label: '어깨', kind: 'length' },
    { key: 'chest', label: '가슴', kind: 'length' },
    { key: 'armLength', label: '팔길이', kind: 'length' },
    { key: 'totalLength', label: '총기장', kind: 'length' },
  ],
  BOTTOM: [
    { key: 'waist', label: '허리', kind: 'length' },
    { key: 'rise', label: '밑위', kind: 'length' },
    { key: 'thigh', label: '허벅지', kind: 'length' },
    { key: 'hem', label: '밑단', kind: 'length' },
    { key: 'totalLength', label: '총기장', kind: 'length' },
  ],
  SHOES: [{ key: 'shoeSize', label: '사이즈', kind: 'shoe' }],
  DRESS: [
    { key: 'shoulder', label: '어깨', kind: 'length' },
    { key: 'chest', label: '가슴', kind: 'length' },
    { key: 'armLength', label: '소매길이', kind: 'length' },
    { key: 'waist', label: '허리', kind: 'length' },
    { key: 'hip', label: '엉덩이', kind: 'length' },
    { key: 'totalLength', label: '총기장', kind: 'length' },
  ],
  BAG: [],
  HAT: [],
  JEWELRY: [],
};

const INCH_TO_CM = 2.54;
const LB_TO_KG = 0.45359237;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Convert display value → storage (cm / kg / mm). */
export function toStorageValue(
  kind: MeasurementKind,
  displayValue: string,
  lengthUnit: LengthUnit,
  shoeUnit: ShoeUnit,
  weightUnit: WeightUnit = 'kg',
): string {
  const n = parseNumber(displayValue);
  if (n === null) {
    return '';
  }
  if (kind === 'weight') {
    const kg = weightUnit === 'lb' ? n * LB_TO_KG : n;
    return String(round1(kg));
  }
  if (kind === 'length') {
    const cm = lengthUnit === 'inch' ? n * INCH_TO_CM : n;
    return String(round1(cm));
  }
  // shoe → mm
  let mm = n;
  if (shoeUnit === 'eu') {
    mm = n * (20 / 3);
  } else if (shoeUnit === 'us') {
    // Approximate men's US → Mondopoint mm
    mm = (n + 18.5) * (25 / 3);
  }
  return String(Math.round(mm));
}

/** Convert storage value → display (for selected unit). */
export function fromStorageValue(
  kind: MeasurementKind,
  storedValue: string | undefined,
  lengthUnit: LengthUnit,
  shoeUnit: ShoeUnit,
  weightUnit: WeightUnit = 'kg',
): string {
  if (!storedValue || !storedValue.trim()) {
    return '';
  }
  const n = parseNumber(storedValue);
  if (n === null) {
    return storedValue;
  }
  if (kind === 'weight') {
    const display = weightUnit === 'lb' ? n / LB_TO_KG : n;
    return String(round1(display));
  }
  if (kind === 'length') {
    const display = lengthUnit === 'inch' ? n / INCH_TO_CM : n;
    return String(round1(display));
  }
  let display = n;
  if (shoeUnit === 'eu') {
    display = n / (20 / 3);
  } else if (shoeUnit === 'us') {
    display = n * (3 / 25) - 18.5;
  }
  return String(round1(display));
}

/**
 * Build measurements for persistence.
 * For items, pass girthInputMode so flat (단면) girth values are doubled to circumference.
 * Body prefs omit girthInputMode (circumference-only).
 */
export function buildStoredMeasurements(
  fields: readonly MeasurementFieldDef[],
  draft: Record<string, string>,
  lengthUnits: Record<string, LengthUnit>,
  shoeUnits: Record<string, ShoeUnit>,
  weightUnits: Record<string, WeightUnit> = {},
  girthInputMode: GirthInputMode = 'circ',
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const raw = draft[field.key] ?? '';
    if (!raw.trim()) {
      continue;
    }
    let stored = toStorageValue(
      field.kind,
      raw,
      lengthUnits[field.key] ?? 'cm',
      shoeUnits[field.key] ?? 'mm',
      weightUnits[field.key] ?? 'kg',
    );
    if (
      stored &&
      girthInputMode === 'flat' &&
      field.kind === 'length' &&
      isItemGirthKey(field.key)
    ) {
      const n = parseNumber(stored);
      if (n !== null) {
        stored = String(round1(n * 2));
      }
    }
    if (stored) {
      out[field.key] = stored;
    }
  }
  return out;
}

/**
 * Load stored measurements into draft display values.
 * Stored girth is always circumference; when girthInputMode is flat, show value/2.
 */
export function draftFromStored(
  fields: readonly MeasurementFieldDef[],
  stored: Record<string, string> | undefined,
  girthInputMode: GirthInputMode = 'circ',
): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of fields) {
    let display = fromStorageValue(
      field.kind,
      stored?.[field.key],
      'cm',
      'mm',
      'kg',
    );
    if (
      display &&
      girthInputMode === 'flat' &&
      field.kind === 'length' &&
      isItemGirthKey(field.key)
    ) {
      const n = parseNumber(display);
      if (n !== null) {
        display = String(round1(n / 2));
      }
    }
    draft[field.key] = display;
  }
  return draft;
}

/** Convert girth draft values when switching 단면 ↔ 둘레 (same display unit). */
export function convertGirthDraftForModeChange(
  draft: Record<string, string>,
  fields: readonly MeasurementFieldDef[],
  fromMode: GirthInputMode,
  toMode: GirthInputMode,
): Record<string, string> {
  if (fromMode === toMode) {
    return draft;
  }
  const next = { ...draft };
  const factor = fromMode === 'flat' && toMode === 'circ' ? 2 : 0.5;
  for (const field of fields) {
    if (!isItemGirthKey(field.key) || field.kind !== 'length') {
      continue;
    }
    const raw = next[field.key] ?? '';
    const n = parseNumber(raw);
    if (n === null) {
      continue;
    }
    next[field.key] = String(round1(n * factor));
  }
  return next;
}

export function formatMeasurementSummary(
  fields: readonly MeasurementFieldDef[],
  stored: Record<string, string> | undefined,
): string {
  if (!stored) {
    return '';
  }
  const parts: string[] = [];
  for (const field of fields) {
    const v = stored[field.key];
    if (!v) {
      continue;
    }
    if (field.kind === 'weight') {
      parts.push(`${field.label} ${v}kg`);
    } else if (field.kind === 'shoe') {
      parts.push(`${field.label} ${v}mm`);
    } else {
      parts.push(`${field.label} ${v}cm`);
    }
  }
  return parts.join(' · ');
}

/** True if any measurement value is non-empty after trim. */
export function hasBodyMeasurements(
  measurements: Record<string, string> | null | undefined,
): boolean {
  if (!measurements) {
    return false;
  }
  return Object.values(measurements).some(
    (v) => typeof v === 'string' && v.trim().length > 0,
  );
}
