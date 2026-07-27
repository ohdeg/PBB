import type { ReactNode } from 'react';

interface VevenoCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function VevenoCard({ title, action, children, className = '' }: VevenoCardProps) {
  return (
    <section className={`brew-card ${className}`.trim()}>
      {title || action ? (
        <div className="brew-card__head">
          {title ? <h2 className="brew-card__title">{title}</h2> : <span />}
          {action ? <div className="brew-card__action">{action}</div> : null}
        </div>
      ) : null}
      <div className="brew-card__body">{children}</div>
    </section>
  );
}
