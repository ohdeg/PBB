export type { LibraryTemporiItem } from './library';

export interface TemporiSummary {
  id: string;
  title: string;
  artist: string | null;
  createdAt: string;
  fileName?: string;
  annotationId?: string;
  syncState?: 'local' | 'saved' | 'failed';
  offline?: boolean;
}

export interface TemporiDetail {
  id: string;
  title: string;
  artist: string | null;
  storagePath: string;
  createdAt: string;
  fileName?: string;
  annotationId?: string;
  syncState?: 'local' | 'saved' | 'failed';
  offline?: boolean;
}
