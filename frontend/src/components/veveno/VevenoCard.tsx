import type { ReactNode } from 'react';

interface VevenoCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function VevenoCard({ title, action, children, className = '' }: VevenoCardProps) {
  return (
    <section className={`veveno-card ${className}`.trim()}>
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
