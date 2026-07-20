import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface LottoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function LottoButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: LottoButtonProps) {
  const baseStyle =
    'px-6 py-3 rounded-2xl font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-500/20',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50',
  };

  return (
    <button
      type="button"
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
