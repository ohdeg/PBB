import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from '../i18n/LanguageContext';

interface FloatingSettingsPanelProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function FloatingSettingsPanel({
  isOpen,
  onOpen,
  onClose,
  children,
  footer,
}: FloatingSettingsPanelProps) {
  const t = useTranslation();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeHandlerRef = useRef(onClose);
  closeHandlerRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHandlerRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return (
    <div className="floating-settings">
      <div className="floating-settings-anchor">
        <button
          ref={triggerRef}
          type="button"
          className={`floating-settings-trigger${isOpen ? ' active' : ''}`}
          onClick={isOpen ? onClose : onOpen}
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={isOpen ? t('floating.closeSettings') : t('floating.openSettings')}
        >
          <span className="floating-settings-trigger-icon" aria-hidden="true">
            ⚙
          </span>
          <span className="floating-settings-trigger-label">{t('floating.settingsLabel')}</span>
        </button>

        {isOpen && (
          <div
            id={panelId}
            className="floating-settings-panel"
            role="dialog"
            aria-modal="false"
            aria-label={t('floating.practiceSettings')}
          >
            <div className="floating-settings-header">
              <h2 className="floating-settings-title">{t('floating.practiceSettings')}</h2>
              <button
                ref={closeRef}
                type="button"
                className="floating-settings-close"
                onClick={onClose}
                aria-label={t('floating.closeSettings')}
              >
                ✕
              </button>
            </div>
            <div className="floating-settings-body">{children}</div>
            {footer && <div className="floating-settings-footer">{footer}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
