import { useEffect, useId, type ReactNode } from 'react';

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
          aria-label={isOpen ? '설정 닫기' : '설정 열기'}
        >
          <span className="floating-settings-trigger-icon" aria-hidden="true">
            ⚙
          </span>
          <span className="floating-settings-trigger-label">설정</span>
        </button>

        {isOpen && (
          <>
            <button
              type="button"
              className="floating-settings-backdrop"
              onClick={onClose}
              aria-label="설정 닫기"
            />
            <div
              id={panelId}
              className="floating-settings-panel"
              role="dialog"
              aria-modal="true"
              aria-label="연습 설정"
            >
              <div className="floating-settings-header">
                <h2 className="floating-settings-title">연습 설정</h2>
                <button
                  type="button"
                  className="floating-settings-close"
                  onClick={onClose}
                  aria-label="설정 닫기"
                >
                  ✕
                </button>
              </div>
              <div className="floating-settings-body">{children}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
