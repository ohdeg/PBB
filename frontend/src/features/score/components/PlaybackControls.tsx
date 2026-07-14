import { Button } from '../../../components/ui/Button';
import {
  TIME_SIGNATURE_PRESETS,
  formatTimeSignature,
  type TimeSignature,
} from '../utils/measureTiming';
import type { BeatStrengthLevel } from '../utils/beatStrength';
import type { BeatSubdivisionId } from '../utils/beatSubdivision';
import { formatTransposeLabel } from '../utils/transpose';
import BeatStrengthBarGrid from './BeatStrengthBarGrid';

type PlaybackControlsMode = 'score' | 'metronome';

interface PlaybackControlsProps {
  mode?: PlaybackControlsMode;
  bpm: number;
  timeSignature: TimeSignature;
  isPlaying: boolean;
  isCountingIn: boolean;
  isAutoScroll: boolean;
  isMetronomeEnabled: boolean;
  isMeasureHighlightEnabled: boolean;
  elapsedMs: number;
  currentMeasureIndex: number;
  totalMeasures: number;
  isSavingPrefs: boolean;
  savePrefsEnabled?: boolean;
  onBpmChange: (bpm: number) => void;
  onTimeSignatureChange: (signature: TimeSignature) => void;
  onBeatsPerMeasureChange: (beats: number) => void;
  onBeatTypeChange: (beatType: number) => void;
  onTogglePlay: () => void;
  onAutoScrollChange: (enabled: boolean) => void;
  onMetronomeChange: (enabled: boolean) => void;
  onMeasureHighlightChange: (enabled: boolean) => void;
  startMeasure: number;
  onStartMeasureChange: (measure: number) => void;
  onSeekToStartMeasure: () => void;
  onResetToBeginning: () => void;
  onSavePrefs: () => void;
  transposeSemitones: number;
  onTransposeDown: () => void;
  onTransposeUp: () => void;
  onTransposeReset: () => void;
  measuresPerLine: number;
  onMeasuresPerLineChange: (measuresPerLine: number) => void;
  beatStrengths: BeatStrengthLevel[];
  beatSubdivisions: BeatSubdivisionId[];
  onBeatStrengthChange: (beatIndex: number, strength: BeatStrengthLevel) => void;
  onBeatSubdivisionChange: (beatIndex: number, subdivisionId: BeatSubdivisionId) => void;
  beatHighlightElapsedMs?: number;
  isBeatHighlightActive?: boolean;
}

export default function PlaybackControls({
  mode = 'score',
  bpm,
  timeSignature,
  isPlaying,
  isCountingIn,
  isAutoScroll,
  isMetronomeEnabled,
  isMeasureHighlightEnabled,
  elapsedMs,
  currentMeasureIndex,
  totalMeasures,
  isSavingPrefs,
  savePrefsEnabled = true,
  onBpmChange,
  onTimeSignatureChange,
  onBeatsPerMeasureChange,
  onBeatTypeChange,
  onTogglePlay,
  onAutoScrollChange,
  onMetronomeChange,
  onMeasureHighlightChange,
  startMeasure,
  onStartMeasureChange,
  onSeekToStartMeasure,
  onResetToBeginning,
  onSavePrefs,
  transposeSemitones,
  onTransposeDown,
  onTransposeUp,
  onTransposeReset,
  measuresPerLine,
  onMeasuresPerLineChange,
  beatStrengths,
  beatSubdivisions,
  onBeatStrengthChange,
  onBeatSubdivisionChange,
  beatHighlightElapsedMs,
  isBeatHighlightActive,
}: PlaybackControlsProps) {
  const isMetronomeMode = mode === 'metronome';
  const beatCount = Math.max(timeSignature.beatsPerMeasure, 1);
  const highlightActive = isBeatHighlightActive ?? (isPlaying || isCountingIn);
  const highlightElapsedMs = beatHighlightElapsedMs ?? elapsedMs;

  return (
    <div className="playback-controls">
      <Button onClick={onTogglePlay}>
        {isCountingIn ? '예비박 중지' : isPlaying ? '일시정지' : '재생'}
      </Button>

      <div className="playback-field">
        <label>BPM</label>
        <input
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={(event) => onBpmChange(Number(event.target.value))}
        />
      </div>

      {!isMetronomeMode && (
        <div className="playback-row playback-transpose">
          <span className="playback-inline-label">조옮김</span>
          <Button variant="secondary" onClick={onTransposeDown} aria-label="키 다운 (반음 내림)">
            키 다운
          </Button>
          <span className="playback-transpose-value">{formatTransposeLabel(transposeSemitones)}</span>
          <Button variant="secondary" onClick={onTransposeUp} aria-label="키 업 (반음 올림)">
            키 업
          </Button>
          {transposeSemitones !== 0 && (
            <Button variant="outline" onClick={onTransposeReset}>
              원조
            </Button>
          )}
        </div>
      )}

      <div className="playback-field playback-field-wide">
        <label>박자</label>
        <input
          type="number"
          min={1}
          max={16}
          value={timeSignature.beatsPerMeasure}
          onChange={(event) => onBeatsPerMeasureChange(Number(event.target.value))}
          aria-label="한 마디 박 수"
        />
        <span className="playback-slash">/</span>
        <input
          type="number"
          min={1}
          max={16}
          value={timeSignature.beatType}
          onChange={(event) => onBeatTypeChange(Number(event.target.value))}
          aria-label="박 단위"
        />
        <span className="playback-meta">({formatTimeSignature(timeSignature)})</span>
      </div>

      <div className="playback-presets">
        <span className="playback-presets-label">박자 프리셋</span>
        {TIME_SIGNATURE_PRESETS.map((preset) => {
          const label = formatTimeSignature(preset);
          const isActive =
            preset.beatsPerMeasure === timeSignature.beatsPerMeasure &&
            preset.beatType === timeSignature.beatType;

          return (
            <button
              key={label}
              type="button"
              className={`playback-preset ${isActive ? 'active' : ''}`}
              onClick={() => onTimeSignatureChange(preset)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="playback-meta">
        경과 시간: {(elapsedMs / 1000).toFixed(2)}s
        {!isMetronomeMode && (
          <>
            {' '}
            · 현재 마디: {currentMeasureIndex + 1} / {Math.max(totalMeasures, 1)}
          </>
        )}
      </p>

      {!isMetronomeMode && (
        <div className="playback-row">
          <label className="playback-inline-label">시작 마디</label>
          <input
            type="number"
            min={1}
            max={Math.max(totalMeasures, 1)}
            value={startMeasure}
            onChange={(event) => onStartMeasureChange(Number(event.target.value))}
            className="playback-measure-input"
          />
          <Button variant="secondary" onClick={onSeekToStartMeasure}>
            이 위치로 이동
          </Button>
          <Button variant="outline" onClick={onResetToBeginning}>
            처음으로
          </Button>
        </div>
      )}

      {!isMetronomeMode && (
        <div className="playback-field">
          <label htmlFor="measures-per-line">줄당 마디</label>
          <input
            id="measures-per-line"
            type="number"
            min={0}
            max={32}
            value={measuresPerLine}
            onChange={(event) => onMeasuresPerLineChange(Number(event.target.value))}
            aria-label="줄당 마디 수"
          />
          <span className="playback-meta">{measuresPerLine === 0 ? '자동' : `${measuresPerLine}마디`}</span>
        </div>
      )}

      <div className="playback-strength-section">
        <span className="playback-presets-label">박자 강약</span>
        <p className="playback-strength-hint">
          막대 클릭: 강 → 중간 → 약 → 무음 · 아이콘 클릭: 세분화 선택
        </p>
        <BeatStrengthBarGrid
          beatCount={beatCount}
          beatStrengths={beatStrengths}
          beatSubdivisions={beatSubdivisions}
          onBeatStrengthChange={onBeatStrengthChange}
          onBeatSubdivisionChange={onBeatSubdivisionChange}
          isHighlightActive={highlightActive}
          highlightElapsedMs={highlightElapsedMs}
          bpm={bpm}
        />
      </div>

      <div className="playback-toggles">
        {!isMetronomeMode && (
          <label className="playback-checkbox">
            <input type="checkbox" checked={isAutoScroll} onChange={(e) => onAutoScrollChange(e.target.checked)} />
            자동 스크롤
          </label>
        )}
        <label className="playback-checkbox">
          <input
            type="checkbox"
            checked={isMetronomeEnabled}
            onChange={(e) => onMetronomeChange(e.target.checked)}
          />
          박자 소리
        </label>
        {!isMetronomeMode && (
          <label className="playback-checkbox">
            <input
              type="checkbox"
              checked={isMeasureHighlightEnabled}
              onChange={(e) => onMeasureHighlightChange(e.target.checked)}
            />
            진행 마디 표시
          </label>
        )}
      </div>

      {savePrefsEnabled && (
        <Button onClick={onSavePrefs} disabled={isSavingPrefs}>
          {isSavingPrefs ? '저장 중...' : 'BPM 설정 저장'}
        </Button>
      )}
    </div>
  );
}
