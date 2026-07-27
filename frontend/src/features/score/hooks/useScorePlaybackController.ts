import { useScorePlaybackStore } from '../store/scorePlaybackStore'

export function useScorePlaybackController() {
  const bpm = useScorePlaybackStore((state) => state.bpm)
  const beatsPerMeasure = useScorePlaybackStore((state) => state.beatsPerMeasure)
  const beatType = useScorePlaybackStore((state) => state.beatType)
  const isPlaying = useScorePlaybackStore((state) => state.isPlaying)
  const elapsedMs = useScorePlaybackStore((state) => state.elapsedMs)
  const currentMeasureIndex = useScorePlaybackStore(
    (state) => state.currentMeasureIndex,
  )
  const isAutoScroll = useScorePlaybackStore((state) => state.isAutoScroll)
  const isMetronomeEnabled = useScorePlaybackStore(
    (state) => state.isMetronomeEnabled,
  )
  const isMeasureHighlightEnabled = useScorePlaybackStore(
    (state) => state.isMeasureHighlightEnabled,
  )
  const measuresPerLine = useScorePlaybackStore((state) => state.measuresPerLine)
  const scrollSmoothing = useScorePlaybackStore((state) => state.scrollSmoothing)
  const autoScrollMode = useScorePlaybackStore((state) => state.autoScrollMode)
  const beatStrengths = useScorePlaybackStore((state) => state.beatStrengths)
  const beatSubdivisions = useScorePlaybackStore(
    (state) => state.beatSubdivisions,
  )
  const setBpm = useScorePlaybackStore((state) => state.setBpm)
  const setTimeSignature = useScorePlaybackStore(
    (state) => state.setTimeSignature,
  )
  const setPlaying = useScorePlaybackStore((state) => state.setPlaying)
  const setElapsedMs = useScorePlaybackStore((state) => state.setElapsedMs)
  const setCurrentMeasureIndex = useScorePlaybackStore(
    (state) => state.setCurrentMeasureIndex,
  )
  const setAutoScroll = useScorePlaybackStore((state) => state.setAutoScroll)
  const setMetronomeEnabled = useScorePlaybackStore(
    (state) => state.setMetronomeEnabled,
  )
  const setMeasureHighlightEnabled = useScorePlaybackStore(
    (state) => state.setMeasureHighlightEnabled,
  )
  const setMeasuresPerLine = useScorePlaybackStore(
    (state) => state.setMeasuresPerLine,
  )
  const setBeatStrengthAt = useScorePlaybackStore(
    (state) => state.setBeatStrengthAt,
  )
  const setBeatSubdivisionAt = useScorePlaybackStore(
    (state) => state.setBeatSubdivisionAt,
  )
  const resetPlayback = useScorePlaybackStore((state) => state.resetPlayback)

  return {
    bpm,
    beatsPerMeasure,
    beatType,
    isPlaying,
    elapsedMs,
    currentMeasureIndex,
    isAutoScroll,
    isMetronomeEnabled,
    isMeasureHighlightEnabled,
    measuresPerLine,
    scrollSmoothing,
    autoScrollMode,
    beatStrengths,
    beatSubdivisions,
    setBpm,
    setTimeSignature,
    setPlaying,
    setElapsedMs,
    setCurrentMeasureIndex,
    setAutoScroll,
    setMetronomeEnabled,
    setMeasureHighlightEnabled,
    setMeasuresPerLine,
    setBeatStrengthAt,
    setBeatSubdivisionAt,
    resetPlayback,
  }
}
