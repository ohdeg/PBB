import { useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  /** boot: 초기 세션, route: 페이지 전환 */
  mode?: 'boot' | 'route';
  /** false가 되면 페이드아웃 후 onExited */
  visible?: boolean;
  message?: string;
  onExited?: () => void;
}

const EXIT_MS = 320;

export function SplashScreen({
  mode = 'boot',
  visible = true,
  message,
  onExited,
}: SplashScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) {
      return;
    }

    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
      onExitedRef.current?.();
    }, EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [visible, mounted]);

  if (!mounted) {
    return null;
  }

  const status = message ?? null;

  return (
    <div
      className={`splash-screen ${mode === 'route' ? 'is-route' : 'is-boot'} ${leaving ? 'is-leaving' : ''}`}
      role="presentation"
      aria-hidden={!visible || leaving}
    >
      <div className="splash-atmosphere" aria-hidden />
      <div className="splash-orb splash-orb-a" aria-hidden />
      <div className="splash-orb splash-orb-b" aria-hidden />

      <div className="splash-content">
        <div className="splash-mark" aria-hidden>
          <span className="splash-mark-ring" />
          <span className="splash-mark-core">B</span>
        </div>
        <p className="splash-brand">PBB</p>
        <p className="splash-tagline">Play beom&apos;s BAG</p>
        {status ? <p className="splash-status">{status}</p> : null}
        <div className="splash-progress" aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}
