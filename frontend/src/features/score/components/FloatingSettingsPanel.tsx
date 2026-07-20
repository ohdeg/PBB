import { useEffect, useId, type ReactNode } from 'react';
import { useTranslation } from '../i18n/LanguageContext';

interface FloatingSettingsPanelProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}

export default function FloatingSettingsPanel({
  isOpen,
  onOpen,
  onClose,
  children,
}: FloatingSettingsPanelProps) {
  const t = useTranslation();
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className="floating-settings">
      <div className="floating-settings-anchor">
        <button
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
                type="button"
                className="floating-settings-close"
                onClick={onClose}
                aria-label={t('floating.closeSettings')}
              >
                ✕
              </button>
            </div>
            <div className="floating-settings-body">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}
