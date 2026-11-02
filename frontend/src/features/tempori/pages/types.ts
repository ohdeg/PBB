export type ScoreSource = { kind: 'pdf'; id: string; blob: Blob } | { kind: 'musicxml'; id: string; xml: string };
export type PageTurnOrigin = 'swipe' | 'bottom' | 'keyboard' | 'camera' | 'playback';
export interface ScorePage { index: number; width: number; height: number; firstMeasureIndex?: number; lastMeasureIndex?: number }
export interface PageTurnRequest { delta: -1 | 1; origin: PageTurnOrigin; timestamp: number }
export interface PageDocument { pages: ScorePage[]; measurePages?: number[]; render: (index: number, target: HTMLElement, zoom?: number) => Promise<void>; dispose: () => void }
