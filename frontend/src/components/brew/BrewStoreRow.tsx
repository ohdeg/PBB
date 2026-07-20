import type { ReactNode } from 'react';
import { BrewBadge } from './BrewBadge';

interface BrewStoreRowProps {
  name: string;
  subtitle?: string;
  badge?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}

export function BrewStoreRow({
  name,
  subtitle,
  badge,
  selected = false,
  onClick,
  trailing,
}: BrewStoreRowProps) {
  const className = [
    'brew-store-row',
    selected ? 'is-selected' : '',
    onClick ? 'is-clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <div className="brew-store-row__main">
          <div className="brew-store-row__title-row">
            <p className="brew-store-row__name">{name}</p>
            {selected ? <BrewBadge variant="info">선택</BrewBadge> : null}
          </div>
          {subtitle ? <p className="brew-store-row__sub">{subtitle}</p> : null}
        </div>
        {trailing ?? badge}
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="brew-store-row__main">
        <div className="brew-store-row__title-row">
          <p className="brew-store-row__name">{name}</p>
        </div>
        {subtitle ? <p className="brew-store-row__sub">{subtitle}</p> : null}
      </div>
      {trailing ?? badge}
    </div>
  );
}
