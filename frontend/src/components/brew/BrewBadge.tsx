import type { ReactNode } from 'react';

interface BrewBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function BrewBadge({ children, variant = 'default' }: BrewBadgeProps) {
  return (
    <span className={`brew-badge brew-badge--${variant}`}>{children}</span>
  );
}
