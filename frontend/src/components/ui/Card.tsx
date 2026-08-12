import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'md' | 'lg';
}

export function Card({
  children,
  className = '',
  padding = 'lg',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-[18px] border border-[#E0E0E0] bg-white',
        padding === 'lg' ? 'p-6' : 'p-4',
        className,
      ]
        .join(' ')
        .trim()}
      {...props}
    >
      {children}
    </div>
  );
}
