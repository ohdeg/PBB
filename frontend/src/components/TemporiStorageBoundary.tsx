import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { migrateTemporiStorageOnce } from '../features/tempori/utils/migrateTemporiStorage';
import { getTemporiRedirectTarget } from '../features/tempori/utils/legacyTemporiRoute';
import { Button } from './ui/Button';

/** Keep lazy feature modules unmounted until their persistent state is ready. */
export function TemporiStorageBoundary() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void migrateTemporiStorageOnce().then(
      () => { if (active) setState('ready'); },
      () => { if (active) setState('error'); },
    );
    return () => { active = false; };
  }, [attempt]);
  if (state === 'ready') return <Outlet />;
  return (
    <main className="tempori-main library-page">
      {state === 'loading'
        ? <p className="tempori-status" role="status">Tempori 보관함을 준비하고 있습니다.</p>
        : <div>
            <p className="tempori-error" role="alert">저장된 보관함을 불러오지 못했습니다. 다른 탭을 닫고 다시 시도해 주세요.</p>
            <Button onClick={() => { setState('loading'); setAttempt((value) => value + 1); }}>다시 시도</Button>
          </div>}
    </main>
  );
}

export function LegacyTemporiRedirect() {
  const location = useLocation();
  return <Navigate to={getTemporiRedirectTarget(location)} replace />;
}
