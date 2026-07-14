import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SplashScreen } from './SplashScreen';

const ROUTE_SPLASH_MS = 650;

/**
 * 실제 pathname/search 가 바뀔 때만 스플래시를 한 번 표시합니다.
 * 마운트·StrictMode 재실행에서는 경로가 같으면 건너뜁니다.
 */
export function RouteSplash() {
  const location = useLocation();
  const locationKey = `${location.pathname}${location.search}`;
  const previousKeyRef = useRef(locationKey);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (locationKey === previousKeyRef.current) {
      return;
    }
    previousKeyRef.current = locationKey;

    setVisible(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, ROUTE_SPLASH_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [locationKey]);

  return <SplashScreen mode="route" visible={visible} />;
}
