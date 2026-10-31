export function DietaLoadState({ error, onRetry }: { error?: string; onRetry: () => void }) {
  return <section className="dieta-card dieta-load-state" aria-busy={!error}>
    {error ? <><h2>잠시 연결이 끊겼어요</h2><p role="alert">{error}</p><button className="dieta-btn dieta-btn--primary" onClick={onRetry}>다시 시도</button></> : <p role="status">기록을 불러오는 중…</p>}
  </section>;
}
