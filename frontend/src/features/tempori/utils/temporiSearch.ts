import type { LibraryTemporiItem } from '../types/library';

function matchesTemporiQuery(
  tempori: Pick<LibraryTemporiItem, 'title' | 'artist' | 'fileName'>,
  normalized: string,
): boolean {
  const title = tempori.title.toLocaleLowerCase();
  const artist = tempori.artist?.toLocaleLowerCase() ?? '';
  const fileName = tempori.fileName?.toLocaleLowerCase() ?? '';
  return (
    title.includes(normalized) ||
    artist.includes(normalized) ||
    fileName.includes(normalized)
  );
}

export function filterLibraryTemporiItemsByQuery(
  temporiItems: LibraryTemporiItem[],
  query: string,
): LibraryTemporiItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return temporiItems;
  }

  return temporiItems.filter((tempori) => matchesTemporiQuery(tempori, normalized));
}

export function filterTemporiItemsByQuery(
  temporiItems: Array<Pick<LibraryTemporiItem, 'title' | 'artist' | 'fileName'>>,
  query: string,
): typeof temporiItems {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return temporiItems;
  }

  return temporiItems.filter((tempori) => matchesTemporiQuery(tempori, normalized));
}
