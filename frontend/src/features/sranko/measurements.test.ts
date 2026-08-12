import { describe, expect, it } from 'vitest';
import {
  buildStoredMeasurements,
  draftFromStored,
  fromStorageValue,
  ITEM_MEASUREMENT_FIELDS,
  toStorageValue,
  type MeasurementFieldDef,
} from './measurements';

const CHEST_FIELD: readonly MeasurementFieldDef[] = [
  { key: 'chest', label: '가슴', kind: 'length' },
];

const SHOULDER_FIELD: readonly MeasurementFieldDef[] = [
  { key: 'shoulder', label: '어깨', kind: 'length' },
];

describe('measurements units', () => {
  it('converts inch to cm', () => {
    expect(toStorageValue('length', '10', 'inch', 'mm')).toBe('25.4');
  });
  it('keeps cm', () => {
    expect(toStorageValue('length', '100', 'cm', 'mm')).toBe('100');
  });
  it('converts eu shoe to mm', () => {
    expect(Number(toStorageValue('shoe', '42', 'cm', 'eu'))).toBeCloseTo(280, 0);
  });
  it('roundtrips length display', () => {
    const stored = toStorageValue('length', '10', 'inch', 'mm');
    expect(fromStorageValue('length', stored, 'inch', 'mm')).toBe('10');
  });
  it('converts lb to kg', () => {
    // 154.3 lb × 0.45359237 ≈ 70.0 kg (1-decimal round)
    expect(toStorageValue('weight', '154.3', 'cm', 'mm', 'lb')).toBe('70');
  });
  it('keeps kg', () => {
    expect(toStorageValue('weight', '70.5', 'cm', 'mm', 'kg')).toBe('70.5');
  });
  it('converts stored kg to lb display', () => {
    expect(fromStorageValue('weight', '70', 'cm', 'mm', 'lb')).toBe('154.3');
  });
  it('roundtrips weight display via kg storage', () => {
    const stored = toStorageValue('weight', '70', 'cm', 'mm', 'kg');
    expect(fromStorageValue('weight', stored, 'cm', 'mm', 'lb')).toBe('154.3');
    expect(fromStorageValue('weight', stored, 'cm', 'mm', 'kg')).toBe('70');
  });
});

describe('item girth flat vs circ', () => {
  it('stores DRESS shoulder first without flat-mode conversion', () => {
    const fields = ITEM_MEASUREMENT_FIELDS.DRESS;

    expect(fields.map((field) => field.key)).toEqual([
      'shoulder',
      'chest',
      'armLength',
      'waist',
      'hip',
      'totalLength',
    ]);
    expect(fields.find((field) => field.key === 'armLength')?.label).toBe('소매길이');
    expect(
      buildStoredMeasurements(
        fields,
        {
          shoulder: '42',
          chest: '50',
          armLength: '58',
          waist: '40',
          hip: '52',
          totalLength: '110',
        },
        {},
        {},
        {},
        'flat',
      ),
    ).toEqual({
      shoulder: '42',
      chest: '100',
      armLength: '58',
      waist: '80',
      hip: '104',
      totalLength: '110',
    });
  });

  it('flat 59 → store 118 circumference', () => {
    expect(
      buildStoredMeasurements(
        CHEST_FIELD,
        { chest: '59' },
        {},
        {},
        {},
        'flat',
      ),
    ).toEqual({ chest: '118' });
  });

  it('circ 118 → store 118', () => {
    expect(
      buildStoredMeasurements(
        CHEST_FIELD,
        { chest: '118' },
        {},
        {},
        {},
        'circ',
      ),
    ).toEqual({ chest: '118' });
  });

  it('does not double non-girth keys in flat mode', () => {
    expect(
      buildStoredMeasurements(
        SHOULDER_FIELD,
        { shoulder: '45' },
        {},
        {},
        {},
        'flat',
      ),
    ).toEqual({ shoulder: '45' });
  });

  it('loads stored circ as half when editing in flat mode', () => {
    expect(
      draftFromStored(CHEST_FIELD, { chest: '118' }, 'flat'),
    ).toEqual({ chest: '59' });
  });

  it('loads stored circ as-is in circ mode', () => {
    expect(
      draftFromStored(CHEST_FIELD, { chest: '118' }, 'circ'),
    ).toEqual({ chest: '118' });
  });
});
