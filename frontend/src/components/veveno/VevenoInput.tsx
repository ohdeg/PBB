import { forwardRef, type InputHTMLAttributes } from 'react';

interface BrewInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const BrewInput = forwardRef<HTMLInputElement, BrewInputProps>(
  function BrewInput({ label, error, hint, className = '', id, ...props }, ref) {
    const inputId = id ?? (label ? label.replace(/\s/g, '-').toLowerCase() : undefined);

    return (
      <div className={`brew-field ${className}`.trim()}>
        {label ? (
          <label htmlFor={inputId} className="brew-field__label">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`brew-field__input${error ? ' is-error' : ''}`}
          {...props}
        />
        {hint && !error ? <span className="brew-field__hint">{hint}</span> : null}
        {error ? <span className="brew-field__error">{error}</span> : null}
      </div>
    );
  },
);
