import { useTranslation } from '../i18n/LanguageContext';
import type { BeatStrengthLevel } from '../utils/beatStrength';

interface MetronomeBeatIndicatorProps {
  visible: boolean;
  beatsPerMeasure: number;
  activeBeatIndex: number | null;
  beatStrengths: BeatStrengthLevel[];
  isCountingIn: boolean;
}

export default function MetronomeBeatIndicator({
  visible,
  beatsPerMeasure,
  activeBeatIndex,
  beatStrengths,
  isCountingIn,
}: MetronomeBeatIndicatorProps) {
  const t = useTranslation();
  const beatCount = Math.max(1, Math.floor(beatsPerMeasure));

  if (!visible) {
    return null;
  }

  return (
    <div className="metronome-beat-indicator" role="status" aria-label={t('metronomePanel.beatIndicatorAria')}>
      <span className={`metronome-beat-indicator-tag${isCountingIn ? ' is-countin' : ''}`}>
        {isCountingIn
          ? t('metronomePanel.countIn')
          : `${activeBeatIndex !== null ? activeBeatIndex + 1 : 1} / ${beatCount}`}
      </span>
      <div className="metronome-beat-dots">
        {Array.from({ length: beatCount }, (_, beatIndex) => {
          const strength = beatStrengths[beatIndex] ?? 'strong';
          const isActive = activeBeatIndex === beatIndex;

          return (
            <span
              key={beatIndex}
              className={`metronome-beat-dot metronome-beat-dot--${strength}${
                isActive ? ' is-active' : ''
              }`}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}
