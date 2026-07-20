import { useEffect, useState } from 'react';

interface SixPickSplashScreenProps {
  onFinish: () => void;
}

const HOLD_MS = 1200;
const TOTAL_MS = 1600;

export function SixPickSplashScreen({ onFinish }: SixPickSplashScreenProps) {
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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-700 transition-opacity duration-400 ${
        isExiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      role="presentation"
      aria-hidden={isExiting}
    >
      <div
        className={`flex flex-col items-center transition-transform duration-500 ${
          isExiting ? 'scale-95' : 'scale-100'
        }`}
      >
        <img
          src="/6pick/logo.svg"
          alt=""
          width={128}
          height={128}
          className="h-32 w-32 drop-shadow-2xl"
          draggable={false}
        />
        <p className="mt-5 text-3xl font-black tracking-[0.2em] text-white">
          6PICK
        </p>
        <p className="mt-2 text-sm font-bold text-violet-200">로또 번호 전략</p>
      </div>
    </div>
  );
}
