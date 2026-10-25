export type { LibraryTemporiItem } from './library';

export interface TemporiSummary {
  id: string;
  title: string;
  artist: string | null;
  createdAt: string;
  fileName?: string;
}

export interface TemporiDetail {
  id: string;
  title: string;
  artist: string | null;
  storagePath: string;
  createdAt: string;
  fileName?: string;
}
