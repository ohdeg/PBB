import { Button } from '../../../components/ui/Button';
import { useTranslation } from '../i18n/LanguageContext';

interface FloatingPlaybackButtonProps {
  visible: boolean;
  isPlaying: boolean;
  isCountingIn: boolean;
  currentMeasureIndex: number;
  totalMeasures: number;
  onTogglePlay: () => void;
}

export default function FloatingPlaybackButton({
  visible,
  isPlaying,
  isCountingIn,
  currentMeasureIndex,
  totalMeasures,
  onTogglePlay,
}: FloatingPlaybackButtonProps) {
  const t = useTranslation();

  if (!visible) return null;

  const isActive = isPlaying || isCountingIn;
  const buttonLabel = isCountingIn
    ? t('playback.stopCountIn')
    : isPlaying
      ? t('playback.pause')
      : t('playback.play');

  return (
    <div className="floating-playback" role="toolbar" aria-label={t('floating.playbackToolbar')}>
      {isCountingIn && <span className="floating-playback-countin">{t('floating.countInOneMeasure')}</span>}
      <span className="floating-playback-measure">
        {t('floating.progressMeasure', {
          current: currentMeasureIndex + 1,
          total: Math.max(totalMeasures, 1),
        })}
      </span>
      <Button onClick={onTogglePlay} variant={isActive ? 'primary' : 'secondary'}>
        {buttonLabel}
      </Button>
    </div>
  );
}
