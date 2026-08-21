import type { ChangeEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { Card } from './ui/Card';

interface FormFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
  error,
  disabled = false,
  maxLength,
}: FormFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[14px] font-semibold tracking-[-0.224px] text-[var(--text)]"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={[
          'h-11 w-full rounded-full border bg-[var(--bg-elevated)] px-5 py-3 text-[17px] tracking-[-0.374px] text-[var(--text)]',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'placeholder:text-[var(--text-muted)]',
          'border-[var(--border-strong)]',
          'focus:border-[var(--accent-hover)] focus:outline-none',
          'focus:shadow-[0_0_0_2px_var(--accent-hover)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-[var(--danger)]' : '',
        ].join(' ')}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="m-0 text-[14px] leading-snug tracking-[-0.224px] text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="m-0 text-[14px] tracking-[-0.224px] text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__toggle">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-[420px]">
        <header className="mb-6">
          <Link
            to="/"
            className="auth-home-link mb-4 inline-block text-[14px] tracking-[-0.224px] text-[var(--text-muted)] no-underline hover:text-[var(--text)]"
          >
            ← 홈
          </Link>
          <p className="m-0 font-[family-name:var(--font-display)] text-[21px] font-semibold tracking-[0.231px] text-[var(--text)]">
            PBB
          </p>
          <p className="mt-1 text-[12px] font-normal tracking-[-0.12px] text-[var(--text-muted)]">
            Play beom&apos;s BAG
          </p>
          <h1 className="mt-4 mb-0 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.374px] text-[var(--text)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 mb-0 text-[17px] leading-[1.47] tracking-[-0.374px] text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </header>
        {children}
        {footer ? (
          <footer className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[17px] tracking-[-0.374px] text-[var(--text-muted)] [&_a]:font-normal [&_a]:text-[var(--accent)]">
            {footer}
          </footer>
        ) : null}
      </Card>
    </div>
  );
}
