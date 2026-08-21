import { useEffect, useState, type InputHTMLAttributes } from 'react';

type ScoreNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

const clamp = (value: number, min?: number, max?: number): number => {
  let next = value;
  if (typeof min === 'number' && Number.isFinite(min)) {
    next = Math.max(min, next);
  }
  if (typeof max === 'number' && Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  return next;
};

export default function ScoreNumberInput({
  value,
  onChange,
  min,
  max,
  onFocus,
  onBlur,
  ...rest
}: ScoreNumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={focused ? draft : value}
      onFocus={(event) => {
        setFocused(true);
        setDraft(String(value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw === '') {
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          return;
        }
        onChange(parsed);
      }}
      onBlur={(event) => {
        setFocused(false);
        const parsed = Number(draft);
        if (draft === '' || !Number.isFinite(parsed)) {
          setDraft(String(value));
        } else {
          const next = clamp(parsed, min, max);
          onChange(next);
          setDraft(String(next));
        }
        onBlur?.(event);
      }}
    />
  );
}
