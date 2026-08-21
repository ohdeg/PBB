import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--on-primary)] disabled:opacity-50',
  secondary:
    'bg-[var(--bg-elevated)] text-[var(--text)] disabled:opacity-50',
  outline:
    'bg-[var(--bg-elevated)] text-[var(--text)] border border-[var(--border-strong)] disabled:opacity-50',
  ghost:
    'bg-transparent text-[var(--text)] disabled:opacity-50',
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5',
        'text-[20px] font-medium tracking-[-0.1px] leading-[1.4]',
        'transition-transform duration-150 ease-out',
        'active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT_CLASS[variant],
        className,
      ]
        .join(' ')
        .trim()}
      {...props}
    >
      {children}
    </button>
  );
}
