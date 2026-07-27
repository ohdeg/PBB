import type { ReactNode } from 'react';

interface VevenoBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function VevenoBadge({ children, variant = 'default' }: VevenoBadgeProps) {
  return (
    <span className={`brew-badge brew-badge--${variant}`}>{children}</span>
  );
}
