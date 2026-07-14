import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { ScoreViewer } from '../features/score/ScoreViewer';
import { blobToMusicXml } from '../features/score/utils/scoreLoader';

interface LoadedScore {
  fileName: string;
  musicXml: string;
}

export function ScoreViewerPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loaded, setLoaded] = useState<LoadedScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const musicXml = await blobToMusicXml(file);
      setLoaded({ fileName: file.name, musicXml });
    } catch (loadError) {
      console.error('악보 파일 로드 실패:', loadError);
      setLoaded(null);
      setError('MusicXML(.musicxml) 또는 MXL(.mxl) 파일만 열 수 있습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    setLoaded(null);
    setError(null);
  }, []);

  return (
    <main className="score-main">
      <Link to="/" className="back-link">
        ← 메인
      </Link>
      <p className="page-kicker">음악</p>
      <h1>Score Viewer</h1>
      <p className="score-lead">
        MusicXML 악보를 열어 OSMD로 보고, 메트로놈·조옮김·마디 이동으로 연습할 수 있습니다.
      </p>

      <div className="score-upload-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".musicxml,.mxl,.xml,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml"
          className="score-file-input"
          onChange={(event) => void handleFileChange(event)}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? '불러오는 중…' : '악보 파일 열기'}
        </button>
        {loaded && (
          <>
            <span className="score-file-name">{loaded.fileName}</span>
            <button type="button" className="btn-secondary" onClick={handleClear}>
              닫기
            </button>
          </>
        )}
      </div>

      {error && <p className="score-viewer-error">{error}</p>}

      {loaded ? (
        <ScoreViewer key={loaded.fileName} musicXml={loaded.musicXml} />
      ) : (
        !isLoading && (
          <p className="empty-state">
            .musicxml 또는 .mxl 파일을 선택하면 악보가 표시됩니다.
          </p>
        )
      )}
    </main>
  );
}
