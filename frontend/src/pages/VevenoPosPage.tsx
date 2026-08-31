import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import { useTranslation } from '../features/veveno/i18n/LanguageContext';
import { getDemoPosSession } from '../features/veveno/pos/demoSession';
import { VEVENO_DEMO_STORE_ID } from '../features/veveno/vevenoDemo';
import {
  clearVevenoPosToken,
  getVevenoPosToken,
} from '../features/veveno/pos/session';
import { useAuthStore } from '../stores/authStore';

const HUB = '/hobbies/veveno/hub';

/** 북마크 `/pos` → 유효한 POS 세션이면 카운터, 아니면 허브 QR 모달. */
export function VevenoPosPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [checking, setChecking] = useState(
    () => Boolean(getVevenoPosToken() || getDemoPosSession()),
  );

  useEffect(() => {
    if (getDemoPosSession()) {
      void navigate(`/hobbies/veveno/pos/store/${VEVENO_DEMO_STORE_ID}`, {
        replace: true,
      });
      return;
    }
    if (!getVevenoPosToken()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    void vevenoApi
      .posMe()
      .then((res) => {
        if (!cancelled) {
          void navigate(`/hobbies/veveno/pos/store/${res.data.storeId}`, {
            replace: true,
          });
        }
      })
      .catch(() => {
        clearVevenoPosToken();
        if (!cancelled) {
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <main className="veveno-shell">
        <div className="veveno-shell__inner veveno-shell__loading">{t('hub.loading')}</div>
      </main>
    );
  }

  if (!accessToken) {
    return <Navigate to={{ pathname: HUB, search: '?pos=1' }} replace />;
  }
  return <Navigate to={HUB} replace />;
}
