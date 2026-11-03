import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTemporiState } from '../services/TemporiStateProvider';
import type { PracticeState } from '../services/temporiStateRepository';
import { ScorePageViewer } from './ScorePageViewer';
import type { ScoreSource } from './types';
import TemporiAnnotationToolbar, { dispatchAnnotationClear, dispatchAnnotationUndo } from '../components/TemporiAnnotationToolbar';
import { loadAnnotationBrushSizes, saveAnnotationBrushSizes } from '../constants/annotationBrush';
import type { AnnotationToolMode } from '../types/temporiAnnotation';
import { MetronomeAudio } from '../utils/metronomeAudio';
import { TemporiDockSlot, useTemporiViewerSettingsOpen } from '../../../components/TemporiViewerDock';
import BeatStrengthBarGrid from '../components/BeatStrengthBarGrid';
import TemporiNumberInput from '../components/TemporiNumberInput';
import { defaultPdfMetronome, PDF_BEAT_TYPES, pdfMetronomeBeat, pdfMetronomeIntervalMs, resizePdfBeatStrengths, type PdfMetronomeSettings } from '../utils/pdfMetronome';

const initialPractice = (): PracticeState => ({ bpm: 120, tempoChanges: [], startMeasure: 1, endMeasure: 1, isRepeatMode: false, pdfMetronome: defaultPdfMetronome() });
export function PdfTempori({ source, annotationId }: { source: Extract<ScoreSource, { kind: 'pdf' }>; annotationId: string }) {
  const scoreState = useTemporiState();
  const setBusy = scoreState?.setBusy;
  const generation = useRef(0); const applied = useRef(-1);
  const observedConflict = useRef(false);
  // Keep the complete payload paired with its generation, including rapid edits before cache reload.
  const practiceBase = useRef<PracticeState | null>(null);
  const [practice, setPractice] = useState(initialPractice);
  const [initialized, setInitialized] = useState(!scoreState);
  const [tool, setTool] = useState<AnnotationToolMode>('none'); const [sizes, setSizes] = useState(loadAnnotationBrushSizes);
  const [editingSettings, setEditingSettings] = useState(false);
  const [playing, setPlaying] = useState(false); const [beat, setBeat] = useState(0);
  const audio = useRef<MetronomeAudio | null>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const openSettings = useTemporiViewerSettingsOpen();
  const meter = practice.pdfMetronome ?? defaultPdfMetronome();
  const { bpm } = practice;
  useEffect(() => { audio.current = new MetronomeAudio(); return () => audio.current?.dispose(); }, []);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now(); let previous = -1; let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const next = Math.floor(elapsed / pdfMetronomeIntervalMs(bpm, meter.beatType));
      if (next !== previous) {
        previous = next; const current = pdfMetronomeBeat(elapsed, bpm, meter); setBeat(current.index + 1);
        if (current.strength !== 'silent') void audio.current?.playClick(current.strength);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, bpm, meter]);
  useEffect(() => { setBusy?.(playing || tool !== 'none' || editingSettings); return () => setBusy?.(false); }, [setBusy, playing, tool, editingSettings]);
  useEffect(() => {
    if (!scoreState?.ready) return;
    const doc = scoreState.state.documents.practice;
    // Queued persistence can fail after save() returns. A chosen conflict copy is
    // authoritative even when its committed generation trails optimistic edits.
    if (doc?.conflict) { observedConflict.current = true; return; }
    if (playing || tool !== 'none' || editingSettings) return;
    if (doc?.payload && (doc.generation > applied.current || observedConflict.current)) {
      observedConflict.current = false;
      const value = doc.payload as PracticeState;
      practiceBase.current = value; setPractice({ ...value, pdfMetronome: value.pdfMetronome ?? defaultPdfMetronome() });
      generation.current = doc.generation; applied.current = doc.generation; setInitialized(true);
    } else if (!doc?.payload && applied.current < 0 && (doc?.serverKnown || !scoreState.identity.accountId || source.id.startsWith('tempori-'))) {
      const value = initialPractice();
      try {
        scoreState.save('practice', value, doc?.generation ?? 0);
        practiceBase.current = value; setPractice(value); generation.current = (doc?.generation ?? 0) + 1; applied.current = generation.current; setInitialized(true);
      } catch (failure) { scoreState.reportError(failure instanceof Error ? failure.message : '연습 설정을 저장하지 못했습니다.'); }
    }
  }, [scoreState, playing, tool, editingSettings, source.id]);
  const updatePractice = (updates: { bpm?: number; pdfMetronome?: PdfMetronomeSettings }) => {
    if (!initialized) return;
    const base = practiceBase.current ?? practice;
    const value = { ...base, pdfMetronome: base.pdfMetronome ?? defaultPdfMetronome(), ...updates };
    if (JSON.stringify({ ...base, pdfMetronome: base.pdfMetronome ?? defaultPdfMetronome() }) === JSON.stringify(value)) return;
    try {
      scoreState?.save('practice', value, generation.current);
      practiceBase.current = value; setPractice(value); generation.current += 1; applied.current = generation.current;
    } catch (failure) { scoreState?.reportError(failure instanceof Error ? failure.message : '연습 설정을 저장하지 못했습니다.'); }
  };
  return <div className="tempori tempori-pdf">
    <TemporiAnnotationToolbar visible pageMode tool={tool} brushSizes={sizes} onToolChange={setTool} onBrushSizeChange={(key, value) => { const next = { ...sizes, [key]: value }; setSizes(next); saveAnnotationBrushSizes(next); }} onClear={() => { if (window.confirm('이 페이지의 필기를 지울까요?')) dispatchAnnotationClear(annotationId, 'pages'); }} onUndo={() => dispatchAnnotationUndo(annotationId, 'pages')} />
    <ScorePageViewer source={source} annotationId={annotationId} annotationTool={tool} annotationBrushSizes={sizes} />
    <TemporiDockSlot slot="settings"><section ref={settingsRef} className="tempori-pdf-settings" aria-label="PDF 메트로놈 설정" onFocusCapture={() => setEditingSettings(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEditingSettings(false); }}>
      <h2>메트로놈 설정</h2>
      <fieldset disabled={!initialized}>
        <div className="tempori-pdf-meter-row">
          <label className="tempori-pdf-bpm">♩ BPM <TemporiNumberInput data-tempori-settings-focus name="pdf-bpm" autoComplete="off" aria-label="PDF 메트로놈 BPM" min={20} max={300} value={bpm} onChange={value => { if (value >= 20 && value <= 300) updatePractice({ bpm: value }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
          <label>박자 <TemporiNumberInput name="pdf-beats" autoComplete="off" aria-label="PDF 마디당 박자 수" min={1} max={16} step={1} value={meter.beatsPerMeasure} onChange={value => { if (Number.isInteger(value) && value >= 1 && value <= 16) updatePractice({ pdfMetronome: { ...meter, beatsPerMeasure: value, beatStrengths: resizePdfBeatStrengths(meter.beatStrengths, value) } }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
          <span aria-hidden="true">/</span><label><span className="sr-only">기준 음표</span><select name="pdf-beat-type" aria-label="PDF 기준 음표" value={meter.beatType} onChange={event => updatePractice({ pdfMetronome: { ...meter, beatType: Number(event.target.value) } })}>{PDF_BEAT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        </div>
        <p className="tempori-pdf-settings-hint">BPM은 4분음표 기준입니다. 현재 {meter.beatsPerMeasure}/{meter.beatType}박자로 클릭합니다.</p>
        <p className="tempori-pdf-settings-hint">박을 누르면 강 → 중간 → 약 → 무음으로 바뀝니다.</p>
        <BeatStrengthBarGrid beatCount={meter.beatsPerMeasure} beatStrengths={[...meter.beatStrengths]} beatSubdivisions={[]} showSubdivisions={false} onBeatSubdivisionChange={() => {}} onBeatStrengthChange={(index, strength) => { const strengths = [...meter.beatStrengths]; strengths[index] = strength; updatePractice({ pdfMetronome: { ...meter, beatStrengths: strengths } }); }} isHighlightActive={playing} activeBeatIndexOverride={beat - 1} />
      </fieldset>
    </section></TemporiDockSlot>
    <TemporiDockSlot slot="playback"><div className="tempori-pdf-metronome">
      <button type="button" className="tempori-pdf-tempo-shortcut" aria-label="PDF 메트로놈 설정" title="템포·박자·강세 설정" onClick={() => { if (openSettings) openSettings(); else settingsRef.current?.querySelector('input')?.focus(); }}>♩{bpm}</button>
      <button type="button" disabled={!initialized} aria-label={playing ? '메트로놈 정지' : '메트로놈 시작'} title={playing ? '메트로놈 정지' : '메트로놈 시작'} onClick={() => { if (!playing) void audio.current?.resume(); setPlaying(value => !value); }}>{playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}</button>
      <output aria-label="메트로놈 박자">{playing ? beat : '—'}</output>
    </div></TemporiDockSlot>
  </div>;
}
