import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OsmdViewer, { type ScoreRenderSnapshot } from './components/OsmdViewer';
import ScoreAutoScroller from './components/ScoreAutoScroller';
import ScoreMetronome from './components/ScoreMetronome';
import FloatingPlaybackButton from './components/FloatingPlaybackButton';
import FloatingSettingsPanel from './components/FloatingSettingsPanel';
import PlaybackControls from './components/PlaybackControls';
import {
  buildMeasureWindows,
  computePlayheadHighlight,
  getElapsedMsForMeasure,
  parseTimeSignatureFromMusicXml,
} from './utils/measureTiming';
import { scrollToAnchoredMeasure } from './utils/scrollAnchor';
import { clampTransposeSemitones } from './utils/transpose';
import { useScorePlaybackStore } from './store/scorePlaybackStore';

interface ScoreViewerProps {
  musicXml: string;
}

const BPM_STORAGE_KEY = 'music-viewer:last-bpm';

export function ScoreViewer({ musicXml }: ScoreViewerProps) {
  const [snapshot, setSnapshot] = useState<ScoreRenderSnapshot>({
    timings: [],
    measureOffsets: [],
    measureLayoutsInContainer: [],
  });
  const [startMeasure, setStartMeasure] = useState(1);
  const [playbackSyncKey, setPlaybackSyncKey] = useState(0);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInElapsedMs, setCountInElapsedMs] = useState(0);
  const countInFrameRef = useRef<number | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const bpm = useScorePlaybackStore((state) => state.bpm);
  const beatsPerMeasure = useScorePlaybackStore((state) => state.beatsPerMeasure);
  const beatType = useScorePlaybackStore((state) => state.beatType);
  const isPlaying = useScorePlaybackStore((state) => state.isPlaying);
  const elapsedMs = useScorePlaybackStore((state) => state.elapsedMs);
  const currentMeasureIndex = useScorePlaybackStore((state) => state.currentMeasureIndex);
  const isAutoScroll = useScorePlaybackStore((state) => state.isAutoScroll);
  const isMetronomeEnabled = useScorePlaybackStore((state) => state.isMetronomeEnabled);
  const isMeasureHighlightEnabled = useScorePlaybackStore(
    (state) => state.isMeasureHighlightEnabled,
  );
  const measuresPerLine = useScorePlaybackStore((state) => state.measuresPerLine);
  const scrollSmoothing = useScorePlaybackStore((state) => state.scrollSmoothing);
  const beatStrengths = useScorePlaybackStore((state) => state.beatStrengths);
  const beatSubdivisions = useScorePlaybackStore((state) => state.beatSubdivisions);
  const setBpm = useScorePlaybackStore((state) => state.setBpm);
  const setTimeSignature = useScorePlaybackStore((state) => state.setTimeSignature);
  const setBeatsPerMeasure = useScorePlaybackStore((state) => state.setBeatsPerMeasure);
  const setBeatType = useScorePlaybackStore((state) => state.setBeatType);
  const setPlaying = useScorePlaybackStore((state) => state.setPlaying);
  const setElapsedMs = useScorePlaybackStore((state) => state.setElapsedMs);
  const setCurrentMeasureIndex = useScorePlaybackStore((state) => state.setCurrentMeasureIndex);
  const setAutoScroll = useScorePlaybackStore((state) => state.setAutoScroll);
  const setMetronomeEnabled = useScorePlaybackStore((state) => state.setMetronomeEnabled);
  const setMeasureHighlightEnabled = useScorePlaybackStore(
    (state) => state.setMeasureHighlightEnabled,
  );
  const setMeasuresPerLine = useScorePlaybackStore((state) => state.setMeasuresPerLine);
  const setBeatStrengthAt = useScorePlaybackStore((state) => state.setBeatStrengthAt);
  const setBeatSubdivisionAt = useScorePlaybackStore((state) => state.setBeatSubdivisionAt);
  const resetPlayback = useScorePlaybackStore((state) => state.resetPlayback);

  const timeSignature = useMemo(
    () => ({ beatsPerMeasure, beatType }),
    [beatsPerMeasure, beatType],
  );

  useEffect(() => {
    resetPlayback();
    setIsCountingIn(false);
    setStartMeasure(1);
    setPlaybackSyncKey(0);
    setTransposeSemitones(0);
    setPrefsMessage(null);

    const savedBpm = Number(localStorage.getItem(BPM_STORAGE_KEY));
    if (Number.isFinite(savedBpm) && savedBpm > 0) {
      setBpm(savedBpm);
    }
  }, [musicXml, resetPlayback, setBpm]);

  useEffect(() => {
    if (!musicXml.trim()) return;
    setTimeSignature(parseTimeSignatureFromMusicXml(musicXml));
  }, [musicXml, setTimeSignature]);

  const windows = useMemo(
    () => buildMeasureWindows(snapshot.timings, bpm, beatsPerMeasure),
    [snapshot.timings, bpm, beatsPerMeasure],
  );

  const countInDurationMs = useMemo(() => {
    if (windows.length === 0) return 0;
    return windows[0].durationMs;
  }, [windows]);

  const highlightElapsedMs = useMemo(() => {
    if (isCountingIn) {
      return getElapsedMsForMeasure(windows, currentMeasureIndex);
    }
    return elapsedMs;
  }, [isCountingIn, windows, currentMeasureIndex, elapsedMs]);

  const positionHighlight = useMemo(
    () =>
      computePlayheadHighlight(
        snapshot.measureLayoutsInContainer,
        windows,
        highlightElapsedMs,
      ),
    [snapshot.measureLayoutsInContainer, windows, highlightElapsedMs],
  );

  const snapToCurrentMeasureStart = useCallback(() => {
    if (windows.length === 0) return;
    const measureStartMs = getElapsedMsForMeasure(windows, currentMeasureIndex);
    setElapsedMs(measureStartMs);
    setPlaybackSyncKey((previous) => previous + 1);
  }, [windows, currentMeasureIndex, setElapsedMs]);

  useEffect(() => {
    if (!isCountingIn) {
      if (countInFrameRef.current !== null) {
        cancelAnimationFrame(countInFrameRef.current);
        countInFrameRef.current = null;
      }
      setCountInElapsedMs(0);
      return;
    }

    const countInStartTime = performance.now();
    const tick = (now: number) => {
      const countInProgress = now - countInStartTime;
      setCountInElapsedMs(countInProgress);

      if (countInProgress >= countInDurationMs) {
        setIsCountingIn(false);
        setCountInElapsedMs(0);
        const measureStartMs = getElapsedMsForMeasure(windows, currentMeasureIndex);
        setElapsedMs(measureStartMs);
        setPlaying(true);
        setPlaybackSyncKey((previous) => previous + 1);
        return;
      }

      countInFrameRef.current = requestAnimationFrame(tick);
    };

    countInFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (countInFrameRef.current !== null) {
        cancelAnimationFrame(countInFrameRef.current);
        countInFrameRef.current = null;
      }
    };
  }, [isCountingIn, countInDurationMs, windows, currentMeasureIndex, setElapsedMs, setPlaying]);

  const handlePlayPause = useCallback(() => {
    if (isCountingIn) {
      setIsCountingIn(false);
      return;
    }
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (windows.length === 0) return;
    snapToCurrentMeasureStart();
    setIsCountingIn(true);
  }, [isCountingIn, isPlaying, windows.length, snapToCurrentMeasureStart, setPlaying]);

  const seekToMeasureIndex = useCallback(
    (measureIndex: number) => {
      if (windows.length === 0) return;

      setIsCountingIn(false);
      const clampedIndex = Math.max(0, Math.min(measureIndex, windows.length - 1));
      const nextElapsedMs = getElapsedMsForMeasure(windows, clampedIndex);

      setPlaying(false);
      setElapsedMs(nextElapsedMs);
      setCurrentMeasureIndex(clampedIndex);
      setStartMeasure(clampedIndex + 1);
      setPlaybackSyncKey((previous) => previous + 1);

      const measureOffset = snapshot.measureOffsets[clampedIndex];
      if (measureOffset !== undefined) {
        scrollToAnchoredMeasure(measureOffset, scrollSmoothing);
      }
    },
    [
      windows,
      setPlaying,
      setElapsedMs,
      setCurrentMeasureIndex,
      snapshot.measureOffsets,
      scrollSmoothing,
    ],
  );

  const handleMeasureClick = useCallback(
    (measureIndex: number) => {
      if (isPlaying || isCountingIn) return;
      seekToMeasureIndex(measureIndex);
    },
    [isPlaying, isCountingIn, seekToMeasureIndex],
  );

  const handleSeekToStartMeasure = useCallback(() => {
    const totalMeasures = Math.max(snapshot.timings.length, 1);
    const clampedStart = Math.max(1, Math.min(startMeasure, totalMeasures));
    setStartMeasure(clampedStart);
    seekToMeasureIndex(clampedStart - 1);
  }, [seekToMeasureIndex, snapshot.timings.length, startMeasure]);

  const handleResetToBeginning = useCallback(() => {
    setStartMeasure(1);
    seekToMeasureIndex(0);
  }, [seekToMeasureIndex]);

  const handleOsmdSnapshot = useCallback((nextSnapshot: ScoreRenderSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const handleTransposeDown = useCallback(() => {
    setTransposeSemitones((previous) => clampTransposeSemitones(previous - 1));
  }, []);

  const handleTransposeUp = useCallback(() => {
    setTransposeSemitones((previous) => clampTransposeSemitones(previous + 1));
  }, []);

  const handleTransposeReset = useCallback(() => {
    setTransposeSemitones(0);
  }, []);

  const handleSavePrefs = () => {
    setIsSavingPrefs(true);
    setPrefsMessage(null);
    try {
      localStorage.setItem(BPM_STORAGE_KEY, String(bpm));
      setPrefsMessage('BPM 설정을 저장했습니다.');
    } catch (saveError) {
      console.error('BPM 설정 저장 실패:', saveError);
      setPrefsMessage('BPM 저장에 실패했습니다.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.target === document.body) {
        event.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause]);

  if (!musicXml.trim()) {
    return null;
  }

  return (
    <div className="score-viewer">
      <ScoreMetronome
        isPlaying={isPlaying || isCountingIn}
        enabled={isMetronomeEnabled}
        bpm={bpm}
        elapsedMs={isCountingIn ? countInElapsedMs : elapsedMs}
        beatsPerMeasure={beatsPerMeasure}
        beatStrengths={beatStrengths}
        beatSubdivisions={beatSubdivisions}
      />
      <ScoreAutoScroller
        isPlaying={isPlaying && !isCountingIn}
        windows={windows}
        measureOffsets={snapshot.measureOffsets}
        autoScrollEnabled={isAutoScroll}
        scrollBehavior={scrollSmoothing}
        initialElapsedMs={elapsedMs}
        syncKey={playbackSyncKey}
        onElapsedMsChange={setElapsedMs}
        onMeasureIndexChange={setCurrentMeasureIndex}
      />
      <div className="score-viewer-canvas-wrap">
        <FloatingSettingsPanel
          isOpen={isSettingsOpen}
          onOpen={() => setIsSettingsOpen(true)}
          onClose={() => setIsSettingsOpen(false)}
        >
          <p className="practice-status">
            현재 마디: {currentMeasureIndex + 1} / {Math.max(snapshot.timings.length, 1)}
            {' · '}
            박자: {beatsPerMeasure}/{beatType}
            {!isPlaying && !isCountingIn && snapshot.timings.length > 0 && (
              <> · 마디를 클릭해 시작 위치 선택</>
            )}
          </p>

          <PlaybackControls
            bpm={bpm}
            timeSignature={timeSignature}
            isPlaying={isPlaying}
            isCountingIn={isCountingIn}
            isAutoScroll={isAutoScroll}
            isMetronomeEnabled={isMetronomeEnabled}
            isMeasureHighlightEnabled={isMeasureHighlightEnabled}
            elapsedMs={elapsedMs}
            currentMeasureIndex={currentMeasureIndex}
            totalMeasures={snapshot.timings.length}
            isSavingPrefs={isSavingPrefs}
            onBpmChange={setBpm}
            onTimeSignatureChange={setTimeSignature}
            onBeatsPerMeasureChange={setBeatsPerMeasure}
            onBeatTypeChange={setBeatType}
            onTogglePlay={handlePlayPause}
            onAutoScrollChange={setAutoScroll}
            onMetronomeChange={setMetronomeEnabled}
            onMeasureHighlightChange={setMeasureHighlightEnabled}
            startMeasure={startMeasure}
            onStartMeasureChange={setStartMeasure}
            onSeekToStartMeasure={handleSeekToStartMeasure}
            onResetToBeginning={handleResetToBeginning}
            onSavePrefs={handleSavePrefs}
            transposeSemitones={transposeSemitones}
            onTransposeDown={handleTransposeDown}
            onTransposeUp={handleTransposeUp}
            onTransposeReset={handleTransposeReset}
            measuresPerLine={measuresPerLine}
            onMeasuresPerLineChange={setMeasuresPerLine}
            beatStrengths={beatStrengths}
            beatSubdivisions={beatSubdivisions}
            onBeatStrengthChange={setBeatStrengthAt}
            onBeatSubdivisionChange={setBeatSubdivisionAt}
            isBeatHighlightActive={isPlaying || isCountingIn}
            beatHighlightElapsedMs={isCountingIn ? countInElapsedMs : elapsedMs}
          />

          {prefsMessage && <p className="practice-message">{prefsMessage}</p>}
        </FloatingSettingsPanel>

        <OsmdViewer
          musicXml={musicXml}
          transposeSemitones={transposeSemitones}
          measuresPerLine={measuresPerLine}
          positionHighlight={positionHighlight}
          showMeasureHighlight={isMeasureHighlightEnabled}
          measureClickEnabled={!isPlaying && !isCountingIn}
          onMeasureClick={handleMeasureClick}
          onSnapshot={handleOsmdSnapshot}
        />
      </div>
      <FloatingPlaybackButton
        visible
        isPlaying={isPlaying}
        isCountingIn={isCountingIn}
        currentMeasureIndex={currentMeasureIndex}
        totalMeasures={snapshot.timings.length}
        onTogglePlay={handlePlayPause}
      />
    </div>
  );
}
