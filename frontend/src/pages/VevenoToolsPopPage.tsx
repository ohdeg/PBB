import { Navigate, useLocation, useParams } from 'react-router-dom';
import { VevenoToolsPanel } from '../components/veveno/VevenoToolsPanel';
import { getDemoPosSession } from '../features/veveno/pos/demoSession';
import {
  getVevenoPosToken,
  isVevenoPosKioskPath,
} from '../features/veveno/pos/session';
import { isVevenoDemoStoreId } from '../features/veveno/vevenoDemo';
import { useAuthStore } from '../stores/authStore';

export function VevenoToolsPopPage() {
  const { storeId = '' } = useParams();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const isPos = isVevenoPosKioskPath(location.pathname);
  const isDemo = isVevenoDemoStoreId(storeId);
  const hasPosSession = Boolean(getVevenoPosToken() || getDemoPosSession());

  if (!storeId) {
    return <Navigate to="/hobbies/veveno/hub" replace />;
  }
  if (!isDemo && !(isPos && hasPosSession) && !accessToken) {
    return (
      <Navigate
        to={isPos ? '/hobbies/veveno/pos' : `/hobbies/veveno/stores/${storeId}`}
        replace
      />
    );
  }

  return (
    <main className="veveno-tools-pop">
      <VevenoToolsPanel storeId={storeId} popup />
    </main>
  );
}
