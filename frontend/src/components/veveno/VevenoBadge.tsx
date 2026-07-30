import type { ReactNode } from 'react';

interface VevenoBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function VevenoBadge({ children, variant = 'default' }: VevenoBadgeProps) {
  return (
    <span className={`veveno-badge veveno-badge--${variant}`}>{children}</span>
  );
}
