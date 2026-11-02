import { useEffect, useRef, useState } from 'react';
import { ScorePageViewer } from './ScorePageViewer';
import type { ScoreSource } from './types';
import TemporiAnnotationToolbar, { dispatchAnnotationClear, dispatchAnnotationUndo } from '../components/TemporiAnnotationToolbar';
import { loadAnnotationBrushSizes, saveAnnotationBrushSizes } from '../constants/annotationBrush';
import type { AnnotationToolMode } from '../types/temporiAnnotation';
import { MetronomeAudio } from '../utils/metronomeAudio';
import { TemporiDockSlot } from '../../../components/TemporiViewerDock';
export function PdfTempori({ source, annotationId }: { source: Extract<ScoreSource, { kind: 'pdf' }>; annotationId: string }) {
  const [tool, setTool] = useState<AnnotationToolMode>('none'); const [sizes, setSizes] = useState(loadAnnotationBrushSizes);
  const [bpm, setBpm] = useState(120); const [playing, setPlaying] = useState(false); const [beat, setBeat] = useState(0); const audio = useRef<MetronomeAudio | null>(null);
  useEffect(() => { audio.current = new MetronomeAudio(); return () => audio.current?.dispose(); }, []);
  useEffect(() => {
    if (!playing) return; const start = performance.now(); let previous = -1; let frame = 0;
    const tick = () => { const next = Math.floor((performance.now() - start) * bpm / 60000); if (next !== previous) { previous = next; setBeat(next % 4 + 1); void audio.current?.playClick(next % 4 === 0 ? 'strong' : 'medium'); } frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, bpm]);
  return <div className="tempori tempori-pdf">
    <TemporiAnnotationToolbar visible pageMode tool={tool} brushSizes={sizes} onToolChange={setTool} onBrushSizeChange={(key, value) => { const next = { ...sizes, [key]: value }; setSizes(next); saveAnnotationBrushSizes(next); }} onClear={() => { if (window.confirm('이 페이지의 필기를 지울까요?')) dispatchAnnotationClear(annotationId, 'pages'); }} onUndo={() => dispatchAnnotationUndo(annotationId, 'pages')} />
    <ScorePageViewer source={source} annotationId={annotationId} annotationTool={tool} annotationBrushSizes={sizes} />
    <TemporiDockSlot slot="playback"><div className="tempori-pdf-metronome"><label>BPM <input aria-label="PDF 메트로놈 BPM" type="number" min={20} max={300} value={bpm} onChange={(event) => setBpm(Math.min(300, Math.max(20, Number(event.target.value) || 120)))} /></label><button type="button" onClick={() => { void audio.current?.resume(); setPlaying((value) => !value); }}>{playing ? '메트로놈 정지' : '메트로놈 시작'}</button><output aria-label="메트로놈 박자">{playing ? beat : '—'}</output></div></TemporiDockSlot>
  </div>;
}
