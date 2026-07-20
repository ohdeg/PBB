import type { ScoreDetail, ScoreSummary } from '../types';
import type { LibraryScoreItem } from '../types/library';
import { getLocalLibraryUserId } from '../utils/libraryUserId';
import {
  deleteLocalScore,
  fetchLocalScoreContent,
  fetchLocalScoreDetail,
  fetchLocalScores,
  isLocalScoreId,
  saveLocalScore,
} from '../utils/localScores';

export async function fetchLibraryScores(): Promise<LibraryScoreItem[]> {
  const userId = getLocalLibraryUserId();
  const scores = await fetchLocalScores(userId);
  return scores.map((score) => ({
    id: score.id,
    title: score.title,
    artist: score.artist,
    createdAt: score.createdAt,
    fileName: score.fileName,
  }));
}

export async function fetchScoreDetail(scoreId: string): Promise<ScoreDetail> {
  const userId = getLocalLibraryUserId();
  if (!isLocalScoreId(scoreId)) {
    throw new Error('Invalid score id');
  }
  return fetchLocalScoreDetail(userId, scoreId);
}

export async function fetchScoreContent(scoreId: string): Promise<Blob> {
  const userId = getLocalLibraryUserId();
  return fetchLocalScoreContent(userId, scoreId);
}

export async function saveScore(
  file: File,
  title: string,
  artist: string | undefined,
): Promise<ScoreSummary> {
  const userId = getLocalLibraryUserId();
  return saveLocalScore(userId, file, title, artist);
}

export async function deleteLibraryScore(item: LibraryScoreItem): Promise<void> {
  const userId = getLocalLibraryUserId();
  await deleteLocalScore(userId, item.id);
}

export async function deleteScore(score: ScoreSummary): Promise<void> {
  const userId = getLocalLibraryUserId();
  await deleteLocalScore(userId, score.id);
}
