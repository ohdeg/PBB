import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { getBeatStrengthLabel } from '../i18n/beatStrengthLabels';
import {
  cycleBeatStrength,
  getActiveBeatInMeasure,
  type BeatStrengthLevel,
} from '../utils/beatStrength';
import { DEFAULT_BEAT_SUBDIVISION, type BeatSubdivisionId } from '../utils/beatSubdivision';
import BeatSubdivisionIcon from './BeatSubdivisionIcon';
import BeatSubdivisionPicker from './BeatSubdivisionPicker';

interface BeatStrengthBarGridProps {
  beatCount: number;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
  onBeatStrengthChange: (beatIndex: number, strength: BeatStrengthLevel) => void;
  onBeatSubdivisionChange: (beatIndex: number, subdivisionId: BeatSubdivisionId) => void;
  isHighlightActive?: boolean;
  highlightElapsedMs?: number;
  bpm?: number;
  activeBeatIndexOverride?: number | null;
}

type SegmentPosition = 'top' | 'middle' | 'bottom';

const getSegmentState = (
  strength: BeatStrengthLevel,
  position: SegmentPosition,
): 'filled' | 'filled-muted' | 'empty' => {
  if (strength === 'strong') {
    return 'filled';
  }
  if (strength === 'medium') {
    return position === 'top' ? 'empty' : 'filled';
  }
  if (strength === 'weak') {
    return position === 'bottom' ? 'filled' : 'empty';
  }
  return position === 'bottom' ? 'filled-muted' : 'empty';
};

interface BeatStrengthBarProps {
  beatIndex: number;
  strength: BeatStrengthLevel;
  isActive: boolean;
  onCycle: () => void;
  ariaLabel: string;
}

function BeatStrengthBar({ strength, isActive, onCycle, ariaLabel }: BeatStrengthBarProps) {
  const isSolid = strength === 'strong';

  return (
    <button
      type="button"
      className={`beat-strength-bar${isSolid ? ' beat-strength-bar--solid' : ''}${
        isActive ? ' beat-strength-bar--active' : ''
      }`}
      onClick={onCycle}
      aria-label={ariaLabel}
      aria-current={isActive ? 'step' : undefined}
    >
      {isSolid ? (
        <span className="beat-strength-bar-solid" aria-hidden="true" />
      ) : (
        (['top', 'middle', 'bottom'] as SegmentPosition[]).map((position) => (
          <span
            key={position}
            className={`beat-strength-segment beat-strength-segment--${position} beat-strength-segment--${getSegmentState(strength, position)}`}
            aria-hidden="true"
          />
        ))
      )}
    </button>
  );
}

export default function BeatStrengthBarGrid({
  beatCount,
  beatStrengths,
  beatSubdivisions,
  onBeatStrengthChange,
  onBeatSubdivisionChange,
  isHighlightActive = false,
  highlightElapsedMs = 0,
  bpm = 120,
  activeBeatIndexOverride,
}: BeatStrengthBarGridProps) {
  const t = useTranslation();
  const [pickerBeatIndex, setPickerBeatIndex] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const activeBeatIndex = useMemo(() => {
    if (!isHighlightActive) return null;
    if (activeBeatIndexOverride !== undefined) {
      return activeBeatIndexOverride;
    }
    return getActiveBeatInMeasure(highlightElapsedMs, bpm, beatCount);
  }, [isHighlightActive, highlightElapsedMs, bpm, beatCount, activeBeatIndexOverride]);

  useEffect(() => {
    if (pickerBeatIndex === null) return;
    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pickerBeatIndex]);

  return (
    <>
      <div className="beat-strength-grid" aria-live="polite">
        {Array.from({ length: beatCount }, (_, beatIndex) => {
          const strength = beatStrengths[beatIndex] ?? 'strong';
          const subdivisionId = beatSubdivisions[beatIndex] ?? DEFAULT_BEAT_SUBDIVISION;
          const isActive = activeBeatIndex === beatIndex;

          return (
            <div
              key={beatIndex}
              className={`beat-strength-column${isActive ? ' beat-strength-column--active' : ''}`}
            >
              <BeatStrengthBar
                beatIndex={beatIndex}
                strength={strength}
                isActive={isActive}
                onCycle={() => onBeatStrengthChange(beatIndex, cycleBeatStrength(strength))}
                ariaLabel={
                  t('beatStrength.beatAria', {
                    beat: beatIndex + 1,
                    strength: getBeatStrengthLabel(t, strength),
                  }) + (isActive ? t('beatStrength.beatAriaActive') : '')
                }
              />
              <button
                type="button"
                className="beat-subdivision-trigger"
                onClick={() => setPickerBeatIndex(beatIndex)}
                aria-label={t('beatSubdivision.selectAria', { beat: beatIndex + 1 })}
              >
                <BeatSubdivisionIcon
                  subdivisionId={subdivisionId}
                  className="beat-subdivision-trigger-icon"
                />
              </button>
              <span className={`beat-strength-beat-label${isActive ? ' active' : ''}`}>
                {beatIndex + 1}
              </span>
            </div>
          );
        })}
      </div>

      {pickerBeatIndex !== null && (
        <div ref={pickerRef}>
          <BeatSubdivisionPicker
            beatIndex={pickerBeatIndex}
            selectedId={beatSubdivisions[pickerBeatIndex] ?? DEFAULT_BEAT_SUBDIVISION}
            isOpen
            onClose={() => setPickerBeatIndex(null)}
            onSelect={(subdivisionId) => onBeatSubdivisionChange(pickerBeatIndex, subdivisionId)}
          />
        </div>
      )}
    </>
  );
}
