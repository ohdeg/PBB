import { useMemo, useState } from 'react';
import {
  BEAT_STRENGTH_LABELS,
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
}

function BeatStrengthBar({ beatIndex, strength, isActive, onCycle }: BeatStrengthBarProps) {
  const isSolid = strength === 'strong';

  return (
    <button
      type="button"
      className={`beat-strength-bar${isSolid ? ' beat-strength-bar--solid' : ''}${
        isActive ? ' beat-strength-bar--active' : ''
      }`}
      onClick={onCycle}
      aria-label={`${beatIndex + 1}박 ${BEAT_STRENGTH_LABELS[strength]}${isActive ? ' (현재 박)' : ''}`}
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
}: BeatStrengthBarGridProps) {
  const [pickerBeatIndex, setPickerBeatIndex] = useState<number | null>(null);

  const activeBeatIndex = useMemo(() => {
    if (!isHighlightActive) return null;
    return getActiveBeatInMeasure(highlightElapsedMs, bpm, beatCount);
  }, [isHighlightActive, highlightElapsedMs, bpm, beatCount]);

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
              />
              <button
                type="button"
                className="beat-subdivision-trigger"
                onClick={() => setPickerBeatIndex(beatIndex)}
                aria-label={`${beatIndex + 1}박 세분화 선택`}
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
        <BeatSubdivisionPicker
          beatIndex={pickerBeatIndex}
          selectedId={beatSubdivisions[pickerBeatIndex] ?? DEFAULT_BEAT_SUBDIVISION}
          isOpen
          onClose={() => setPickerBeatIndex(null)}
          onSelect={(subdivisionId) => onBeatSubdivisionChange(pickerBeatIndex, subdivisionId)}
        />
      )}
    </>
  );
}
