export type { LibraryScoreItem } from './library';

export interface ScoreSummary {
  id: string;
  title: string;
  artist: string | null;
  createdAt: string;
  fileName?: string;
}

export interface ScoreDetail {
  id: string;
  title: string;
  artist: string | null;
  storagePath: string;
  createdAt: string;
  fileName?: string;
}
