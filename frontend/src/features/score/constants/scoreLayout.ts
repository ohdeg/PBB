export const DEFAULT_MEASURES_PER_LINE = 4;
export const MIN_MEASURES_PER_LINE = 1;
export const MAX_MEASURES_PER_LINE = 12;

export const clampMeasuresPerLine = (measuresPerLine: number): number => {
  if (!Number.isFinite(measuresPerLine)) return DEFAULT_MEASURES_PER_LINE;
  return Math.max(MIN_MEASURES_PER_LINE, Math.min(MAX_MEASURES_PER_LINE, Math.trunc(measuresPerLine)));
};

export interface OsmdLayoutEngravingRules {
  RenderXMeasuresPerLineAkaSystem: number;
  NewSystemAtXMLNewSystemAttribute: boolean;
  NewSystemAtXMLNewPageAttribute: boolean;
  NewPageAtXMLNewPageAttribute: boolean;
}

export const applyOsmdLayoutRules = (
  rules: OsmdLayoutEngravingRules,
  measuresPerLine: number = DEFAULT_MEASURES_PER_LINE,
  respectXmlNewSystem = true,
): void => {
  rules.RenderXMeasuresPerLineAkaSystem = clampMeasuresPerLine(measuresPerLine);
  // Respect MusicXML print new-system marks that we inject per configured measure count.
  // This keeps all systems aligned to the target count, except the last system.
  rules.NewSystemAtXMLNewSystemAttribute = respectXmlNewSystem;
  rules.NewSystemAtXMLNewPageAttribute = false;
  rules.NewPageAtXMLNewPageAttribute = false;
};
