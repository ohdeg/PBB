import { Button } from '../../../components/ui/Button';

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
  if (!visible) return null;

  const isActive = isPlaying || isCountingIn;
  const buttonLabel = isCountingIn ? '예비박 중지' : isPlaying ? '일시정지' : '재생';

  return (
    <div className="floating-playback" role="toolbar" aria-label="재생 컨트롤">
      {isCountingIn && <span className="floating-playback-countin">예비박 1마디</span>}
      <span className="floating-playback-measure">
        마디 {currentMeasureIndex + 1}/{Math.max(totalMeasures, 1)}
      </span>
      <Button onClick={onTogglePlay} variant={isActive ? 'primary' : 'secondary'}>
        {buttonLabel}
      </Button>
    </div>
  );
}
