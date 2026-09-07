import { VevenoButton } from './VevenoButton';

interface VevenoImageFieldProps {
  label: string;
  hint?: string;
  previewUrl: string | null;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
  pickLabel: string;
  clearLabel: string;
}

export function VevenoImageField({
  label,
  hint,
  previewUrl,
  disabled,
  onPick,
  onClear,
  pickLabel,
  clearLabel,
}: VevenoImageFieldProps) {
  return (
    <div className="veveno-field">
      <span className="veveno-field__label">{label}</span>
      {previewUrl ? (
        <img className="veveno-thumb veveno-thumb--lg" src={previewUrl} alt="" />
      ) : null}
      <div className="veveno-btn-row">
        <label className="veveno-file-btn">
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                onPick(file);
              }
            }}
          />
          {pickLabel}
        </label>
        {previewUrl ? (
          <VevenoButton
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={onClear}
          >
            {clearLabel}
          </VevenoButton>
        ) : null}
      </div>
      {hint ? <p className="veveno-field__hint">{hint}</p> : null}
    </div>
  );
}
