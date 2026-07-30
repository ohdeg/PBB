import { forwardRef, type InputHTMLAttributes } from 'react';

interface VevenoInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const VevenoInput = forwardRef<HTMLInputElement, VevenoInputProps>(
  function VevenoInput({ label, error, hint, className = '', id, ...props }, ref) {
    const inputId = id ?? (label ? label.replace(/\s/g, '-').toLowerCase() : undefined);

    return (
      <div className={`veveno-field ${className}`.trim()}>
        {label ? (
          <label htmlFor={inputId} className="veveno-field__label">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`veveno-field__input${error ? ' is-error' : ''}`}
          {...props}
        />
        {hint && !error ? <span className="veveno-field__hint">{hint}</span> : null}
        {error ? <span className="veveno-field__error">{error}</span> : null}
      </div>
    );
  },
);
