import { useEffect, useRef, useState } from 'react';

export interface VevenoMenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function VevenoActionMenu({ actions }: { actions: VevenoMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div className="veveno-menu" ref={rootRef}>
      <button
        type="button"
        className={`veveno-menu__trigger${open ? ' is-open' : ''}`}
        aria-label="더보기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ⋯
      </button>
      {open ? (
        <div className="veveno-menu__list" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={`veveno-menu__item${action.danger ? ' is-danger' : ''}`}
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
