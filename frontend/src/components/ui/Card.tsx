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
        'rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-elevated)]',
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
