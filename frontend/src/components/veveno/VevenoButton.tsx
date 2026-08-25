import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';

interface VevenoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export function VevenoButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: VevenoButtonProps) {
  const t = useTranslation();
  const classes = [
    'veveno-btn',
    `veveno-btn--${variant}`,
    `veveno-btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? t('common.processing') : children}
    </button>
  );
}
