import { Link } from 'react-router-dom';

export function AnalysisPage() {
  return (
    <main className="analysis-main">
      <Link to="/" className="back-link">
        ← 메인
      </Link>
      <p className="page-kicker">스포츠</p>
      <h1>Analyze Baseball</h1>
      <p className="analysis-lead">
        타격·투구·수비 데이터를 한곳에서 읽고, 경기와 선수를 구조적으로
        분석합니다.
      </p>

      <section className="analysis-panel" aria-label="분석 보드">
        <h2>분석 보드</h2>
        <p className="empty-state">표시할 분석 데이터가 없습니다.</p>
      </section>
    </main>
  );
}
