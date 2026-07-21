import { StatusView } from '../components/StatusView';

export function ErrorPage() {
  return (
    <main className="store-main">
      <StatusView variant="error" onRetry={() => window.location.reload()} />
    </main>
  );
}
