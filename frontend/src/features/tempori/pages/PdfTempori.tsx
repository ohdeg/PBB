import { useTemporiState } from '../services/TemporiStateProvider';
import type { PracticeState } from '../services/temporiStateRepository';
import { useEffect, useRef, useState } from 'react';
import { ScorePageViewer } from './ScorePageViewer';
import type { ScoreSource } from './types';
import TemporiAnnotationToolbar, { dispatchAnnotationClear, dispatchAnnotationUndo } from '../components/TemporiAnnotationToolbar';
import { loadAnnotationBrushSizes, saveAnnotationBrushSizes } from '../constants/annotationBrush';
import type { AnnotationToolMode } from '../types/temporiAnnotation';
import { MetronomeAudio } from '../utils/metronomeAudio';
import { TemporiDockSlot } from '../../../components/TemporiViewerDock';
export function PdfTempori({ source, annotationId }: { source: Extract<ScoreSource, { kind: 'pdf' }>; annotationId: string }) {
  const scoreState = useTemporiState(); const generation = useRef(0); const applied = useRef(-1); const savedBpm = useRef<number | null>(null);
  const [tool, setTool] = useState<AnnotationToolMode>('none'); const [sizes, setSizes] = useState(loadAnnotationBrushSizes);
  const [bpm, setBpm] = useState(120); const [playing, setPlaying] = useState(false); const [beat, setBeat] = useState(0); const audio = useRef<MetronomeAudio | null>(null);
  useEffect(() => { audio.current = new MetronomeAudio(); return () => audio.current?.dispose(); }, []);
  useEffect(() => {
    if (!playing) return; const start = performance.now(); let previous = -1; let frame = 0;
    const tick = () => { const next = Math.floor((performance.now() - start) * bpm / 60000); if (next !== previous) { previous = next; setBeat(next % 4 + 1); void audio.current?.playClick(next % 4 === 0 ? 'strong' : 'medium'); } frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, bpm]);
  useEffect(() => { scoreState?.setBusy(playing || tool !== 'none'); return () => scoreState?.setBusy(false); }, [scoreState?.setBusy, playing, tool]);
  useEffect(() => {
    if (!scoreState?.ready || playing || tool !== 'none') return;
    const doc = scoreState.state.documents.practice;
    if (doc?.payload && doc.generation !== applied.current && !doc.conflict) { setBpm((doc.payload as PracticeState).bpm); savedBpm.current = (doc.payload as PracticeState).bpm; generation.current = doc.generation; applied.current = doc.generation; }
    else if (!doc?.payload && applied.current < 0 && (doc?.serverKnown || !scoreState.identity.accountId || source.id.startsWith('tempori-'))) {
      try { scoreState.save('practice', { bpm: 120, tempoChanges: [], startMeasure: 1, endMeasure: 1, isRepeatMode: false }, doc?.generation ?? 0); savedBpm.current = 120; generation.current = (doc?.generation ?? 0) + 1; applied.current = generation.current; }
      catch (failure) { scoreState.reportError(failure instanceof Error ? failure.message : '연습 설정을 저장하지 못했습니다.'); }
    }
  }, [scoreState, playing, tool, source.id]);
  const changeBpm = (value: number) => {
    setBpm(value); if (savedBpm.current === value) return;
    try { scoreState?.save('practice', { bpm: value, tempoChanges: [], startMeasure: 1, endMeasure: 1, isRepeatMode: false }, generation.current); savedBpm.current = value; generation.current += 1; applied.current = generation.current; }
    catch (failure) { scoreState?.reportError(failure instanceof Error ? failure.message : '연습 설정을 저장하지 못했습니다.'); }
  };
  return <div className="tempori tempori-pdf">
    <TemporiAnnotationToolbar visible pageMode tool={tool} brushSizes={sizes} onToolChange={setTool} onBrushSizeChange={(key, value) => { const next = { ...sizes, [key]: value }; setSizes(next); saveAnnotationBrushSizes(next); }} onClear={() => { if (window.confirm('이 페이지의 필기를 지울까요?')) dispatchAnnotationClear(annotationId, 'pages'); }} onUndo={() => dispatchAnnotationUndo(annotationId, 'pages')} />
    <ScorePageViewer source={source} annotationId={annotationId} annotationTool={tool} annotationBrushSizes={sizes} />
    <TemporiDockSlot slot="settings"><label className="tempori-pdf-bpm">BPM <input aria-label="PDF 메트로놈 BPM" type="number" min={20} max={300} value={bpm} onChange={(event) => changeBpm(Math.min(300, Math.max(20, Number(event.target.value) || 120)))} /></label></TemporiDockSlot>
    <TemporiDockSlot slot="playback"><div className="tempori-pdf-metronome"><button type="button" onClick={() => { void audio.current?.resume(); setPlaying((value) => !value); }}>{playing ? '메트로놈 정지' : '메트로놈 시작'}</button><output aria-label="메트로놈 박자">{playing ? beat : '—'}</output></div></TemporiDockSlot>
  </div>;
}
