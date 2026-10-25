import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';

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

  return (
    <Dialog
      open={isOpen}
      title={title}
      onClose={onClose}
      backdropClassName="first-use-guide-backdrop"
      panelClassName="first-use-guide-card"
      description
    >
      {({ titleId, descriptionId }) => (
        <>
        <p className="first-use-guide-kicker">FIRST VISIT GUIDE</p>
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId} className="first-use-guide-description">
          {description}
        </p>
        <ul className="first-use-guide-list">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <div className="first-use-guide-actions">
          <Button onClick={onClose}>{resolvedCloseLabel}</Button>
        </div>
        </>
      )}
    </Dialog>
  );
}
