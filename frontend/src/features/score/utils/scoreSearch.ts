import type { LibraryScoreItem } from '../types/library';

function matchesScoreQuery(
  score: Pick<LibraryScoreItem, 'title' | 'artist' | 'fileName'>,
  normalized: string,
): boolean {
  const title = score.title.toLocaleLowerCase();
  const artist = score.artist?.toLocaleLowerCase() ?? '';
  const fileName = score.fileName?.toLocaleLowerCase() ?? '';
  return (
    title.includes(normalized) ||
    artist.includes(normalized) ||
    fileName.includes(normalized)
  );
}

export function filterLibraryScoresByQuery(
  scores: LibraryScoreItem[],
  query: string,
): LibraryScoreItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return scores;
  }

  return scores.filter((score) => matchesScoreQuery(score, normalized));
}

export function filterScoresByQuery(
  scores: Array<Pick<LibraryScoreItem, 'title' | 'artist' | 'fileName'>>,
  query: string,
): typeof scores {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return scores;
  }

  return scores.filter((score) => matchesScoreQuery(score, normalized));
}
