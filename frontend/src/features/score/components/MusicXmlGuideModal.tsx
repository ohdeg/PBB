import { useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Button } from '../../../components/ui/Button';

const MUSESCORE_COM_URL = 'https://musescore.com';
const PLAYSCORE_URL = 'https://www.playscore.co';

interface MusicXmlGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MusicXmlGuideModal({ isOpen, onClose }: MusicXmlGuideModalProps) {
  const t = useTranslation();

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
    <div
      className="music-xml-guide-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('musicXmlGuide.dialogLabel')}
    >
      <div className="music-xml-guide-card">
        <p className="music-xml-guide-kicker">{t('musicXmlGuide.kicker')}</p>
        <h3>{t('musicXmlGuide.title')}</h3>
        <p className="music-xml-guide-desc">{t('musicXmlGuide.desc')}</p>

        <section className="music-xml-guide-section">
          <h4>{t('musicXmlGuide.playscoreTitle')}</h4>
          <p className="music-xml-guide-section-desc">
            {t('musicXmlGuide.playscoreDescPrefix')}
            <a href={PLAYSCORE_URL} target="_blank" rel="noopener noreferrer">
              PlayScore 2
            </a>
            {t('musicXmlGuide.playscoreDescSuffix')}
          </p>
          <ol className="music-xml-guide-steps">
            <li>{t('musicXmlGuide.playscoreStep1')}</li>
            <li>{t('musicXmlGuide.playscoreStep2')}</li>
            <li>{t('musicXmlGuide.playscoreStep3')}</li>
            <li>{t('musicXmlGuide.playscoreStep4')}</li>
            <li>{t('musicXmlGuide.playscoreStep5')}</li>
            <li>{t('musicXmlGuide.playscoreStep6')}</li>
            <li>{t('musicXmlGuide.playscoreStep7')}</li>
          </ol>
        </section>

        <section className="music-xml-guide-section">
          <h4>{t('musicXmlGuide.musescoreTitle')}</h4>
          <p className="music-xml-guide-section-desc">
            {t('musicXmlGuide.musescoreDescPrefix')}
            <a href={MUSESCORE_COM_URL} target="_blank" rel="noopener noreferrer">
              MuseScore.com
            </a>
            {t('musicXmlGuide.musescoreDescSuffix')}
          </p>

          <p className="music-xml-guide-subheading">{t('musicXmlGuide.musescoreWebHeading')}</p>
          <ol className="music-xml-guide-steps">
            <li>
              {t('musicXmlGuide.musescoreStep1Prefix')}
              <a href={MUSESCORE_COM_URL} target="_blank" rel="noopener noreferrer">
                musescore.com
              </a>
              {t('musicXmlGuide.musescoreStep1Suffix')}
            </li>
            <li>{t('musicXmlGuide.musescoreStep2')}</li>
            <li>{t('musicXmlGuide.musescoreStep3')}</li>
            <li>{t('musicXmlGuide.musescoreStep4')}</li>
            <li>{t('musicXmlGuide.musescoreStep5')}</li>
            <li>{t('musicXmlGuide.musescoreStep6')}</li>
            <li>{t('musicXmlGuide.musescoreStep7')}</li>
          </ol>

          <ul className="music-xml-guide-tips">
            <li>{t('musicXmlGuide.musescoreTipFree')}</li>
            <li>{t('musicXmlGuide.musescoreTipPro')}</li>
            <li>{t('musicXmlGuide.musescoreTipMissing')}</li>
          </ul>
        </section>

        <section className="music-xml-guide-section music-xml-guide-section--highlight">
          <h4>{t('musicXmlGuide.workflowTitle')}</h4>
          <ol className="music-xml-guide-steps">
            <li>{t('musicXmlGuide.workflowStep1')}</li>
            <li>{t('musicXmlGuide.workflowStep2')}</li>
            <li>{t('musicXmlGuide.workflowStep3')}</li>
          </ol>
        </section>

        <p className="music-xml-guide-note">{t('musicXmlGuide.note')}</p>

        <div className="music-xml-guide-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.open(PLAYSCORE_URL, '_blank', 'noopener,noreferrer');
            }}
          >
            PlayScore 2
          </Button>
          <Button
            type="button"
            onClick={() => {
              window.open(MUSESCORE_COM_URL, '_blank', 'noopener,noreferrer');
            }}
          >
            {t('musicXmlGuide.openMusescore')}
          </Button>
        </div>
      </div>
    </div>
  );
}
