export interface LibraryTemporiItem {
  id: string;
  title: string;
  artist: string | null;
  createdAt: string;
  fileName?: string;
  annotationId?: string;
  syncState?: 'local' | 'saved' | 'failed';
  offline?: boolean;
  serverListUnavailable?: boolean;
  stateSyncPending?: boolean;
}
