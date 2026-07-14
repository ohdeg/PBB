export interface MeasureTiming {
  measureIndex: number;
  divisions: number;
  durationSum: number;
}

export interface ScoreMeta {
  title: string;
  composer?: string;
  defaultBpm: number;
}
