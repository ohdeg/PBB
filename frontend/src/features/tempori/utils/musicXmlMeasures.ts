export interface UnifiedMeasureGroup {
  measureIndex: number;
  measureNumber: string | null;
  elements: Element[];
}

export const parseMusicXmlDocument = (musicXmlText: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(musicXmlText, 'application/xml');
};

export const collectUnifiedMeasureGroups = (xmlDoc: Document): UnifiedMeasureGroup[] => {
  const parts = Array.from(xmlDoc.querySelectorAll('part'));
  if (parts.length === 0) {
    return [];
  }

  const partMeasures = parts.map((part) => Array.from(part.querySelectorAll(':scope > measure')));
  const referenceMeasures = partMeasures[0];
  if (referenceMeasures.length === 0) {
    return [];
  }

  const hasMismatchedMeasureCounts = partMeasures.some(
    (measures) => measures.length !== referenceMeasures.length,
  );
  if (!hasMismatchedMeasureCounts) {
    return referenceMeasures.map((referenceMeasure, measureIndex) => {
      const elements = partMeasures
        .map((measures) => measures[measureIndex])
        .filter((measure): measure is Element => measure !== undefined);

      return {
        measureIndex,
        measureNumber: referenceMeasure.getAttribute('number'),
        elements: elements.length > 0 ? elements : [referenceMeasure],
      };
    });
  }

  const partCursors = partMeasures.map(() => 0);

  const findAlignedMeasure = (
    measures: Element[],
    measureNumber: string | null,
    fallbackIndex: number,
    partIndex: number,
  ): Element | undefined => {
    const cursor = partCursors[partIndex];
    if (measureNumber) {
      for (let index = cursor; index < measures.length; index += 1) {
        if (measures[index].getAttribute('number') === measureNumber) {
          partCursors[partIndex] = index + 1;
          return measures[index];
        }
      }
    }

    if (fallbackIndex < measures.length) {
      partCursors[partIndex] = Math.max(partCursors[partIndex], fallbackIndex + 1);
      return measures[fallbackIndex];
    }

    if (cursor < measures.length) {
      partCursors[partIndex] = cursor + 1;
      return measures[cursor];
    }

    return undefined;
  };

  return referenceMeasures.map((referenceMeasure, measureIndex) => {
    const measureNumber = referenceMeasure.getAttribute('number');
    const elements = parts
      .map((_, partIndex) =>
        findAlignedMeasure(partMeasures[partIndex], measureNumber, measureIndex, partIndex),
      )
      .filter((measure): measure is Element => measure !== undefined);

    return {
      measureIndex,
      measureNumber,
      elements: elements.length > 0 ? elements : [referenceMeasure],
    };
  });
};

export const getPrimaryMeasureElement = (group: UnifiedMeasureGroup): Element => group.elements[0];
