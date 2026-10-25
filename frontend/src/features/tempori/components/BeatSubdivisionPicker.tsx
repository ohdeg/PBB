import { useEffect, useState } from 'react';
import {
  getSubdivisionPattern,
  getSubdivisionPatternsByPage,
  type BeatSubdivisionId,
} from '../utils/beatSubdivision';
import { useTranslation } from '../i18n/LanguageContext';
import BeatSubdivisionIcon from './BeatSubdivisionIcon';

interface BeatSubdivisionPickerProps {
  beatIndex: number;
  selectedId: BeatSubdivisionId;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (subdivisionId: BeatSubdivisionId) => void;
}

export default function BeatSubdivisionPicker({
  beatIndex,
  selectedId,
  isOpen,
  onClose,
  onSelect,
}: BeatSubdivisionPickerProps) {
  const t = useTranslation();
  const [page, setPage] = useState<0 | 1>(0);
  const beatNumber = beatIndex + 1;

  useEffect(() => {
    if (!isOpen) return;

    const selectedPage = getSubdivisionPattern(selectedId).page;
    setPage(selectedPage);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedId, onClose]);

  if (!isOpen) return null;

  const patterns = getSubdivisionPatternsByPage(page);

  return (
    <div
      className="beat-subdivision-picker-inline"
      role="dialog"
      aria-modal="false"
      aria-label={t('beatSubdivision.dialogLabel', { beat: beatNumber })}
    >
      <div className="beat-subdivision-picker-inline-header">
        <h3 className="beat-subdivision-picker-title">
          {t('beatSubdivision.title', { beat: beatNumber })}
        </h3>
        <button type="button" className="beat-subdivision-picker-close" onClick={onClose}>
          {t('beatSubdivision.close')}
        </button>
      </div>

      <div className="beat-subdivision-picker-grid">
        {patterns.map((pattern) => {
          const isSelected = pattern.id === selectedId;
          return (
            <button
              key={pattern.id}
              type="button"
              className={`beat-subdivision-picker-option${isSelected ? ' selected' : ''}`}
              onClick={() => {
                onSelect(pattern.id);
                onClose();
              }}
              aria-label={pattern.label}
              aria-pressed={isSelected}
            >
              <BeatSubdivisionIcon subdivisionId={pattern.id} className="beat-subdivision-picker-icon" />
            </button>
          );
        })}
      </div>

      <div className="beat-subdivision-picker-footer">
        <button
          type="button"
          className="beat-subdivision-picker-nav"
          onClick={() => setPage(0)}
          disabled={page === 0}
          aria-label={t('beatSubdivision.page1Aria')}
        >
          {t('beatSubdivision.page1')}
        </button>

        <div className="beat-subdivision-picker-pagination" aria-hidden="true">
          <span className={`beat-subdivision-picker-page-dot${page === 0 ? ' active' : ''}`} />
          <span className={`beat-subdivision-picker-page-dot${page === 1 ? ' active' : ''}`} />
        </div>

        <button
          type="button"
          className="beat-subdivision-picker-nav"
          onClick={() => setPage(1)}
          disabled={page === 1}
          aria-label={t('beatSubdivision.page2Aria')}
        >
          {t('beatSubdivision.page2')}
        </button>
      </div>
    </div>
  );
}
