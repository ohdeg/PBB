export interface MeasureTiming {
  measureIndex: number;
  measureNumber: number | null;
  divisions: number;
  durationSum: number;
  expectedDurationDivisions: number;
  beatsPerMeasure: number;
  beatType: number;
  tempoBpm: number | null;
  fermataFactor: number;
  isPickup: boolean;
}

export interface ScoreMeta {
  title: string;
  composer?: string;
  defaultBpm: number;
}
