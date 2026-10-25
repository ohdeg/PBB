import { migrateTemporiStorageOnce } from '../utils/migrateTemporiStorage';
import type { TemporiDetail, TemporiSummary } from '../types';
import type { LibraryTemporiItem } from '../types/library';
import { getLocalLibraryUserId } from '../utils/libraryUserId';
import {
  deleteLocalTempori,
  fetchLocalTemporiContent,
  fetchLocalTemporiDetail,
  fetchLocalTemporiItems,
  isLocalTemporiId,
  saveLocalTempori,
} from '../utils/localTempori';

export async function fetchLibraryTemporiItems(): Promise<LibraryTemporiItem[]> {
  await migrateTemporiStorageOnce();
  const userId = getLocalLibraryUserId();
  const temporiItems = await fetchLocalTemporiItems(userId);
  return temporiItems.map((tempori) => ({
    id: tempori.id,
    title: tempori.title,
    artist: tempori.artist,
    createdAt: tempori.createdAt,
    fileName: tempori.fileName,
  }));
}

export async function fetchTemporiDetail(temporiId: string): Promise<TemporiDetail> {
  await migrateTemporiStorageOnce();
  const userId = getLocalLibraryUserId();
  if (!isLocalTemporiId(temporiId)) {
    throw new Error('Invalid Tempori id');
  }
  return fetchLocalTemporiDetail(userId, temporiId);
}

export async function fetchTemporiContent(temporiId: string): Promise<Blob> {
  await migrateTemporiStorageOnce();
  const userId = getLocalLibraryUserId();
  return fetchLocalTemporiContent(userId, temporiId);
}

export async function saveTempori(
  file: File,
  title: string,
  artist: string | undefined,
): Promise<TemporiSummary> {
  await migrateTemporiStorageOnce();
  const userId = getLocalLibraryUserId();
  return saveLocalTempori(userId, file, title, artist);
}

export async function deleteLibraryTempori(item: LibraryTemporiItem): Promise<void> {
  await migrateTemporiStorageOnce();
  const userId = getLocalLibraryUserId();
  await deleteLocalTempori(userId, item.id);
}

export async function deleteTempori(tempori: TemporiSummary): Promise<void> {
  await migrateTemporiStorageOnce();
  const userId = getLocalLibraryUserId();
  await deleteLocalTempori(userId, tempori.id);
}
