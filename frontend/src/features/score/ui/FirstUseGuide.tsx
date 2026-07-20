import { useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';

interface FirstUseGuideProps {
  isOpen: boolean;
  title: string;
  description: string;
  tips: string[];
  closeLabel?: string;
  onClose: () => void;
}

export function FirstUseGuide({
  isOpen,
  title,
  description,
  tips,
  closeLabel,
  onClose,
}: FirstUseGuideProps) {
  const t = useTranslation();
  const resolvedCloseLabel = closeLabel ?? t('common.close');
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="first-use-guide-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="first-use-guide-card">
        <p className="first-use-guide-kicker">FIRST VISIT GUIDE</p>
        <h3>{title}</h3>
        <p className="first-use-guide-description">{description}</p>
        <ul className="first-use-guide-list">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <div className="first-use-guide-actions">
          <Button onClick={onClose}>{resolvedCloseLabel}</Button>
        </div>
      </div>
    </div>
  );
}
