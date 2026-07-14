import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getSubdivisionPattern,
  getSubdivisionPatternsByPage,
  type BeatSubdivisionId,
} from '../utils/beatSubdivision';
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
  const [page, setPage] = useState<0 | 1>(0);

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

  return createPortal(
    <div className="beat-subdivision-picker" role="presentation">
      <button
        type="button"
        className="beat-subdivision-picker-backdrop"
        onClick={onClose}
        aria-label="세분화 선택 닫기"
      />
      <div
        className="beat-subdivision-picker-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${beatIndex + 1}박 세분화 선택`}
      >
        <h3 className="beat-subdivision-picker-title">{beatIndex + 1}박 세분화</h3>

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
            aria-label="세분화 1페이지"
          >
            ◀ 1페이지
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
            aria-label="세분화 2페이지"
          >
            2페이지 ▶
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
