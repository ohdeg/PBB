import { useCallback, useEffect, useState } from 'react';

interface VevenoSplashScreenProps {
  onFinish: () => void;
}

const HOLD_MS = 1200;
const TOTAL_MS = 1600;

/**
 * Veveno(허브·가게 상세) 안에 머무는 동안 true.
 * 외부 → Veveno 진입 시에만 스플래시를 띄우고,
 * 허브 ↔ 가게 상세처럼 내부 이동에서는 다시 띄우지 않는다.
 */
let insideVeveno = false;

export function useVevenoSplash() {
  const [showSplash, setShowSplash] = useState(() => !insideVeveno);

  useEffect(() => {
    insideVeveno = true;
    return () => {
      insideVeveno = false;
    };
  }, []);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  return { showSplash, handleSplashFinish };
}

export function VevenoSplashScreen({ onFinish }: VevenoSplashScreenProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setIsExiting(true), HOLD_MS);
    const finishTimer = window.setTimeout(onFinish, TOTAL_MS);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`veveno-splash${isExiting ? ' veveno-splash--leaving' : ''}`}
      role="presentation"
      aria-hidden={isExiting}
    >
      <div className="veveno-splash__atmosphere" aria-hidden />
      <div className="veveno-splash__content">
        <div className="veveno-splash__mark" aria-hidden>
          <span className="veveno-splash__mark-ring" />
          <span className="veveno-splash__mark-core">V</span>
        </div>
        <p className="veveno-splash__brand">Veveno</p>
        <p className="veveno-splash__tagline">가게 노트</p>
      </div>
    </div>
  );
}
