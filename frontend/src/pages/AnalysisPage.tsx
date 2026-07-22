import { Link } from 'react-router-dom';

export function AnalysisPage() {
  return (
    <main className="analysis-main">
      <Link to="/" className="back-link">
        ← 메인
      </Link>
      <p className="page-kicker">스포츠</p>
      <h1>iPBT</h1>
      <p className="analysis-lead">
        날씨를 보고 야구가 가능한지 보는 앱
      </p>

      <section className="analysis-panel" aria-label="보드">
        <h2>보드</h2>
        <p className="empty-state">표시할 데이터가 없습니다.</p>
      </section>
    </main>
  );
}
