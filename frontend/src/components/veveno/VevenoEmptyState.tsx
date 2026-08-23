import type { ReactNode } from 'react';

interface VevenoEmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
}

export function VevenoEmptyState({ title, body, action }: VevenoEmptyStateProps) {
  return (
    <div className="veveno-empty-state">
      <h2 className="veveno-empty-state__title">{title}</h2>
      <p className="veveno-empty-state__body">{body}</p>
      {action ? <div className="veveno-empty-state__action">{action}</div> : null}
    </div>
  );
}
