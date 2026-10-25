import { useTemporiPlaybackStore } from '../store/temporiPlaybackStore'

export function useTemporiPlaybackController() {
  const bpm = useTemporiPlaybackStore((state) => state.bpm)
  const beatsPerMeasure = useTemporiPlaybackStore((state) => state.beatsPerMeasure)
  const beatType = useTemporiPlaybackStore((state) => state.beatType)
  const isPlaying = useTemporiPlaybackStore((state) => state.isPlaying)
  const elapsedMs = useTemporiPlaybackStore((state) => state.elapsedMs)
  const currentMeasureIndex = useTemporiPlaybackStore(
    (state) => state.currentMeasureIndex,
  )
  const isAutoScroll = useTemporiPlaybackStore((state) => state.isAutoScroll)
  const isMetronomeEnabled = useTemporiPlaybackStore(
    (state) => state.isMetronomeEnabled,
  )
  const isMeasureHighlightEnabled = useTemporiPlaybackStore(
    (state) => state.isMeasureHighlightEnabled,
  )
  const measuresPerLine = useTemporiPlaybackStore((state) => state.measuresPerLine)
  const scrollSmoothing = useTemporiPlaybackStore((state) => state.scrollSmoothing)
  const autoScrollMode = useTemporiPlaybackStore((state) => state.autoScrollMode)
  const beatStrengths = useTemporiPlaybackStore((state) => state.beatStrengths)
  const beatSubdivisions = useTemporiPlaybackStore(
    (state) => state.beatSubdivisions,
  )
  const setBpm = useTemporiPlaybackStore((state) => state.setBpm)
  const setTimeSignature = useTemporiPlaybackStore(
    (state) => state.setTimeSignature,
  )
  const setPlaying = useTemporiPlaybackStore((state) => state.setPlaying)
  const setElapsedMs = useTemporiPlaybackStore((state) => state.setElapsedMs)
  const setCurrentMeasureIndex = useTemporiPlaybackStore(
    (state) => state.setCurrentMeasureIndex,
  )
  const setAutoScroll = useTemporiPlaybackStore((state) => state.setAutoScroll)
  const setMetronomeEnabled = useTemporiPlaybackStore(
    (state) => state.setMetronomeEnabled,
  )
  const setMeasureHighlightEnabled = useTemporiPlaybackStore(
    (state) => state.setMeasureHighlightEnabled,
  )
  const setMeasuresPerLine = useTemporiPlaybackStore(
    (state) => state.setMeasuresPerLine,
  )
  const setBeatStrengthAt = useTemporiPlaybackStore(
    (state) => state.setBeatStrengthAt,
  )
  const setBeatSubdivisionAt = useTemporiPlaybackStore(
    (state) => state.setBeatSubdivisionAt,
  )
  const resetPlayback = useTemporiPlaybackStore((state) => state.resetPlayback)

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
