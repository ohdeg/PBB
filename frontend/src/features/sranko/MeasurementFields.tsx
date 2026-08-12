import type {
  GirthInputMode,
  LengthUnit,
  MeasurementFieldDef,
  ShoeUnit,
  WeightUnit,
} from './measurements';
import {
  convertGirthDraftForModeChange,
  fromStorageValue,
  isItemGirthKey,
  toStorageValue,
} from './measurements';

interface MeasurementFieldsProps {
  fields: readonly MeasurementFieldDef[];
  draft: Record<string, string>;
  lengthUnits: Record<string, LengthUnit>;
  shoeUnits: Record<string, ShoeUnit>;
  weightUnits: Record<string, WeightUnit>;
  disabled?: boolean;
  /** Item form only: 단면/둘레 for girth keys. Omit for body (circumference-only). */
  girthInputMode?: GirthInputMode;
  onGirthInputModeChange?: (mode: GirthInputMode) => void;
  onDraftChange: (key: string, value: string) => void;
  onDraftReplace?: (next: Record<string, string>) => void;
  onLengthUnitChange: (key: string, unit: LengthUnit) => void;
  onShoeUnitChange: (key: string, unit: ShoeUnit) => void;
  onWeightUnitChange: (key: string, unit: WeightUnit) => void;
}

export function MeasurementFields({
  fields,
  draft,
  lengthUnits,
  shoeUnits,
  weightUnits,
  disabled,
  girthInputMode,
  onGirthInputModeChange,
  onDraftChange,
  onDraftReplace,
  onLengthUnitChange,
  onShoeUnitChange,
  onWeightUnitChange,
}: MeasurementFieldsProps) {
  const showGirthMode =
    girthInputMode != null &&
    onGirthInputModeChange != null &&
    fields.some((f) => isItemGirthKey(f.key));

  const setGirthMode = (next: GirthInputMode) => {
    if (!girthInputMode || next === girthInputMode) {
      return;
    }
    if (onDraftReplace) {
      onDraftReplace(
        convertGirthDraftForModeChange(draft, fields, girthInputMode, next),
      );
    }
    onGirthInputModeChange?.(next);
  };

  return (
    <div className="sranko-measure-fields">
      {showGirthMode ? (
        <div className="sranko-girth-mode">
          <span className="sranko-girth-mode__label">둘레 입력</span>
          <div
            className="sranko-girth-mode__toggle"
            role="group"
            aria-label="단면 또는 둘레"
          >
            <button
              type="button"
              className={
                girthInputMode === 'flat'
                  ? 'sranko-girth-mode__btn is-active'
                  : 'sranko-girth-mode__btn'
              }
              disabled={disabled}
              onClick={() => setGirthMode('flat')}
            >
              단면
            </button>
            <button
              type="button"
              className={
                girthInputMode === 'circ'
                  ? 'sranko-girth-mode__btn is-active'
                  : 'sranko-girth-mode__btn'
              }
              disabled={disabled}
              onClick={() => setGirthMode('circ')}
            >
              둘레
            </button>
          </div>
        </div>
      ) : null}
      <div className="sranko-measure-grid">
        {fields.map((field) => {
          const lengthUnit = lengthUnits[field.key] ?? 'cm';
          const shoeUnit = shoeUnits[field.key] ?? 'mm';
          const weightUnit = weightUnits[field.key] ?? 'kg';
          const isGirth =
            showGirthMode && isItemGirthKey(field.key) && field.kind === 'length';
          const girthHint =
            isGirth && girthInputMode === 'flat'
              ? '단면'
              : isGirth
                ? '둘레'
                : null;
          return (
            <label key={field.key} className="sranko-field sranko-measure-field">
              <span className="sranko-measure-field__label">
                {field.label}
                {girthHint ? (
                  <span className="sranko-measure-field__girth-hint">
                    {' '}
                    ({girthHint})
                  </span>
                ) : null}
              </span>
              <div className="sranko-measure-field__row">
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={disabled}
                  value={draft[field.key] ?? ''}
                  placeholder="선택"
                  onChange={(e) => onDraftChange(field.key, e.target.value)}
                />
                {field.kind === 'length' ? (
                  <select
                    aria-label={`${field.label} 단위`}
                    disabled={disabled}
                    value={lengthUnit}
                    onChange={(e) => {
                      const next = e.target.value as LengthUnit;
                      const current = draft[field.key] ?? '';
                      onLengthUnitChange(field.key, next);
                      if (current.trim()) {
                        const stored = toStorageValue(
                          field.kind,
                          current,
                          lengthUnit,
                          shoeUnit,
                          weightUnit,
                        );
                        onDraftChange(
                          field.key,
                          fromStorageValue(
                            field.kind,
                            stored,
                            next,
                            shoeUnit,
                            weightUnit,
                          ),
                        );
                      }
                    }}
                  >
                    <option value="cm">cm</option>
                    <option value="inch">inch</option>
                  </select>
                ) : null}
                {field.kind === 'weight' ? (
                  <select
                    aria-label={`${field.label} 단위`}
                    disabled={disabled}
                    value={weightUnit}
                    onChange={(e) => {
                      const next = e.target.value as WeightUnit;
                      const current = draft[field.key] ?? '';
                      onWeightUnitChange(field.key, next);
                      if (current.trim()) {
                        const stored = toStorageValue(
                          field.kind,
                          current,
                          lengthUnit,
                          shoeUnit,
                          weightUnit,
                        );
                        onDraftChange(
                          field.key,
                          fromStorageValue(
                            field.kind,
                            stored,
                            lengthUnit,
                            shoeUnit,
                            next,
                          ),
                        );
                      }
                    }}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                ) : null}
                {field.kind === 'shoe' ? (
                  <select
                    aria-label={`${field.label} 단위`}
                    disabled={disabled}
                    value={shoeUnit}
                    onChange={(e) => {
                      const next = e.target.value as ShoeUnit;
                      const current = draft[field.key] ?? '';
                      onShoeUnitChange(field.key, next);
                      if (current.trim()) {
                        const stored = toStorageValue(
                          field.kind,
                          current,
                          lengthUnit,
                          shoeUnit,
                          weightUnit,
                        );
                        onDraftChange(
                          field.key,
                          fromStorageValue(
                            field.kind,
                            stored,
                            lengthUnit,
                            next,
                            weightUnit,
                          ),
                        );
                      }
                    }}
                  >
                    <option value="mm">mm</option>
                    <option value="eu">EU</option>
                    <option value="us">US</option>
                  </select>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>
      {showGirthMode ? (
        <p className="sranko-girth-mode__hint">
          택 숫자는 보통 단면입니다. 저장 시 둘레(cm)로 변환됩니다.
        </p>
      ) : null}
    </div>
  );
}
