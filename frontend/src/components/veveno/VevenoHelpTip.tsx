import { useEffect, useId, useRef, useState } from 'react';

interface VevenoHelpTipProps {
  text: string;
  label?: string;
}

export function VevenoHelpTip({ text, label = '도움말' }: VevenoHelpTipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleId = useId();

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
    <span
      ref={rootRef}
      className={`veveno-help-tip${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className="veveno-help-tip__btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={bubbleId}
        onClick={() => setOpen((prev) => !prev)}
      >
        ?
      </button>
      <span id={bubbleId} role="tooltip" className="veveno-help-tip__bubble">
        {text}
      </span>
    </span>
  );
}
