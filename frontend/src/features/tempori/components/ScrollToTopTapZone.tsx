import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { isIpadLikeDevice } from '../utils/platform';
import { scrollToTop } from '../utils/scrollAnchor';

const TAP_MOVE_THRESHOLD_PX = 12;
const SCROLL_TOP_THRESHOLD_PX = 48;

export default function ScrollToTopTapZone() {
  const t = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSupported = isIpadLikeDevice();

  useEffect(() => {
    if (!isSupported) return;

    const updateActiveState = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setIsActive(scrollTop > SCROLL_TOP_THRESHOLD_PX);
    };

    updateActiveState();
    window.addEventListener('scroll', updateActiveState, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveState);
  }, [isSupported]);

  if (!isSupported || !isActive) return null;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.hypot(deltaX, deltaY) <= TAP_MOVE_THRESHOLD_PX) {
      scrollToTop('smooth');
    }
  };

  const resetPointer = () => {
    pointerStartRef.current = null;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToTop('smooth');
    }
  };

  return (
    <div
      className="scroll-to-top-tap-zone"
      role="button"
      tabIndex={0}
      aria-label={t('floating.scrollToTop')}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetPointer}
      onKeyDown={handleKeyDown}
    />
  );
}
