import type { ReactNode } from 'react';
import { VevenoBadge } from './VevenoBadge';

interface VevenoStoreRowProps {
  name: string;
  subtitle?: string;
  badge?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}

export function VevenoStoreRow({
  name,
  subtitle,
  badge,
  selected = false,
  onClick,
  trailing,
}: VevenoStoreRowProps) {
  const className = [
    'veveno-store-row',
    selected ? 'is-selected' : '',
    onClick ? 'is-clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <div className="veveno-store-row__main">
          <div className="veveno-store-row__title-row">
            <p className="veveno-store-row__name">{name}</p>
            {selected ? <VevenoBadge variant="info">선택</VevenoBadge> : null}
          </div>
          {subtitle ? <p className="veveno-store-row__sub">{subtitle}</p> : null}
        </div>
        {trailing ?? (badge ? <div className="veveno-store-row__badges">{badge}</div> : null)}
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="veveno-store-row__main">
        <div className="veveno-store-row__title-row">
          <p className="veveno-store-row__name">{name}</p>
        </div>
        {subtitle ? <p className="veveno-store-row__sub">{subtitle}</p> : null}
      </div>
      {trailing ?? (badge ? <div className="veveno-store-row__badges">{badge}</div> : null)}
    </div>
  );
}
