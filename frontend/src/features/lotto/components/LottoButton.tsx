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
    'px-[22px] py-[11px] rounded-full text-[17px] font-normal tracking-[-0.374px] transition-transform duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
  const variants = {
    primary: 'bg-[#0066CC] text-white',
    secondary: 'bg-[#FAFAFC] text-[#333333] border-[3px] border-[#F0F0F0]',
    outline: 'border border-[#0066CC] text-[#0066CC] bg-transparent',
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
