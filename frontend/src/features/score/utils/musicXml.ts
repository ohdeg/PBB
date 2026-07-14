/** OSMD string load requires a standard XML declaration at the start of the document. */
export function normalizeMusicXmlForOsmd(musicXmlText: string): string {
  const trimmed = musicXmlText.trimStart();
  if (trimmed.startsWith('<?xml')) {
    return musicXmlText;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${trimmed}`;
}
