import { DEFAULT_MEASURES_PER_LINE, clampMeasuresPerLine } from '../constants/scoreLayout';

const withXmlDeclaration = (musicXmlText: string): string => {
  const trimmed = musicXmlText.trimStart();
  if (trimmed.startsWith('<?xml')) {
    return musicXmlText;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${trimmed}`;
};

const getMeasureElements = (part: Element): Element[] =>
  Array.from(part.childNodes).filter(
    (child): child is Element => child.nodeType === 1 && child.nodeName === 'measure',
  );

const stripLayoutBreakAttributes = (measure: Element): void => {
  measure.querySelectorAll('print').forEach((printNode) => {
    printNode.removeAttribute('new-system');
    printNode.removeAttribute('new-page');
  });
};

const ensureNewSystemAtMeasure = (measure: Element): void => {
  let printNode = measure.querySelector('print');
  if (!printNode) {
    printNode = measure.ownerDocument.createElement('print');
    measure.insertBefore(printNode, measure.firstChild);
  }
  printNode.setAttribute('new-system', 'yes');
};

export const normalizeMusicXmlLayout = (
  musicXmlText: string,
  measuresPerLine: number = DEFAULT_MEASURES_PER_LINE,
): string => {
  const targetMeasuresPerLine = clampMeasuresPerLine(measuresPerLine);

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(withXmlDeclaration(musicXmlText), 'application/xml');
  const parts = Array.from(xmlDoc.querySelectorAll('part'));
  if (parts.length === 0) {
    return musicXmlText;
  }

  parts.forEach((part) => {
    const measures = getMeasureElements(part);
    measures.forEach((measure, measureIndex) => {
      stripLayoutBreakAttributes(measure);
      if (measureIndex > 0 && measureIndex % targetMeasuresPerLine === 0) {
        ensureNewSystemAtMeasure(measure);
      }
    });
  });

  const serialized = new XMLSerializer().serializeToString(xmlDoc);
  if (serialized.startsWith('<?xml')) {
    return serialized;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
};

/** OSMD string load requires a standard XML declaration and fixed measure layout. */
export function normalizeMusicXmlForOsmd(
  musicXmlText: string,
  measuresPerLine: number = DEFAULT_MEASURES_PER_LINE,
): string {
  return normalizeMusicXmlLayout(withXmlDeclaration(musicXmlText), measuresPerLine);
}
