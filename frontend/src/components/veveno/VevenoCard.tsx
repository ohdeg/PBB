import type { ReactNode } from 'react';

interface VevenoCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function VevenoCard({
  title,
  action,
  children,
  className = '',
  onClick,
}: VevenoCardProps) {
  return (
    <section
      className={`veveno-card${onClick ? ' is-clickable' : ''} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {title || action ? (
        <div className="veveno-card__head">
          {title ? <h2 className="veveno-card__title">{title}</h2> : <span />}
          {action ? <div className="veveno-card__action">{action}</div> : null}
        </div>
      ) : null}
      <div className="veveno-card__body">{children}</div>
    </section>
  );
}
