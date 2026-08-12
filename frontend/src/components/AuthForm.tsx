import type { ChangeEvent, ReactNode } from 'react';
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
        className="text-[14px] font-semibold tracking-[-0.224px] text-[#1D1D1F]"
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
          'h-11 w-full rounded-full border bg-white px-5 py-3 text-[17px] tracking-[-0.374px] text-[#1D1D1F]',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'placeholder:text-[#7A7A7A]',
          'border-[rgba(0,0,0,0.08)]',
          'focus:border-[#0071E3] focus:outline-none',
          'focus:shadow-[0_0_0_2px_#0071E3]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-[#FF3B30]' : '',
        ].join(' ')}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="m-0 text-[14px] leading-snug tracking-[-0.224px] text-[#7A7A7A]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="m-0 text-[14px] tracking-[-0.224px] text-[#FF3B30]"
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
    <div className="grid min-h-screen place-items-center bg-[#F5F5F7] px-4 py-10 animate-[page-enter_0.45s_ease-out]">
      <Card className="w-full max-w-[420px]">
        <header className="mb-6">
          <p className="m-0 font-[family-name:var(--font-display)] text-[21px] font-semibold tracking-[0.231px] text-[#1D1D1F]">
            PBB
          </p>
          <p className="mt-1 text-[12px] font-normal tracking-[-0.12px] text-[#7A7A7A]">
            Play beom&apos;s BAG
          </p>
          <h1 className="mt-4 mb-0 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.374px] text-[#1D1D1F]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 mb-0 text-[17px] leading-[1.47] tracking-[-0.374px] text-[#7A7A7A]">
              {subtitle}
            </p>
          ) : null}
        </header>
        {children}
        {footer ? (
          <footer className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[17px] tracking-[-0.374px] text-[#7A7A7A] [&_a]:font-normal [&_a]:text-[#0066CC]">
            {footer}
          </footer>
        ) : null}
      </Card>
    </div>
  );
}
