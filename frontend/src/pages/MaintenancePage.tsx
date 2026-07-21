import { useAppStatusStore } from '../stores/appStatusStore';
import { StatusView } from '../components/StatusView';

export function MaintenancePage() {
  const maintenanceMessage = useAppStatusStore((state) => state.maintenanceMessage);

  return (
    <main className="store-main">
      <StatusView
        variant="maintenance"
        message={maintenanceMessage ?? undefined}
        onRetry={() => window.location.reload()}
      />
    </main>
  );
}
