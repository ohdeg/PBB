import type { PageDocument } from './types';
import type { TemporiRenderSnapshot } from '../components/OsmdViewer';
import { parseMeasureTimingsFromMusicXml } from '../utils/measureTiming';
import { parsePlaybackSequenceFromMusicXml } from '../utils/musicXmlRepeats';
import { normalizeMusicXmlForOsmd } from '../utils/musicXml';
export async function createMusicXmlPageDocument(xml: string, transpose: number, signal: AbortSignal, snapshot?: (value: TemporiRenderSnapshot) => void): Promise<PageDocument> {
  const module = await import('opensheetmusicdisplay');
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;visibility:hidden;pointer-events:none'; document.body.append(host);
  const osmd = new module.OpenSheetMusicDisplay(host, { backend: 'svg', autoResize: false, pageFormat: 'A4 P', newPageFromXML: true, newSystemFromXML: true, newSystemFromNewPageInXML: true, drawPartNames: false, drawPartAbbreviations: false });
  const cleanup = () => { osmd.clear(); host.remove(); };
  try {
    const normalized = normalizeMusicXmlForOsmd(xml, 4, 'pages'); await osmd.load(normalized);
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    osmd.TransposeCalculator = new module.TransposeCalculator(); osmd.Sheet.Transpose = transpose; osmd.updateGraphic(); osmd.render();
    const graphical = osmd.GraphicSheet; const musicPages = graphical.MusicPages;
    const svgs = Array.from(host.querySelectorAll('svg'));
    const measurePages = graphical.MeasureList.map((row) => musicPages.indexOf(row[0]?.ParentMusicSystem.Parent));
    const timings = parseMeasureTimingsFromMusicXml(normalized);
    if (svgs.length !== musicPages.length || !svgs.length || measurePages.length !== timings.length || measurePages.some((page) => page < 0)) throw new Error('일부 마디의 페이지를 확인하지 못했습니다. 다른 보기로 열어 주세요.');
    const pages = svgs.map((svg, index) => ({ index, width: Number(svg.getAttribute('width')) || 794, height: Number(svg.getAttribute('height')) || 1123,
      firstMeasureIndex: measurePages.indexOf(index), lastMeasureIndex: measurePages.lastIndexOf(index) }));
    snapshot?.({ timings, playbackSequence: parsePlaybackSequenceFromMusicXml(normalized), measureOffsets: [], measureLayoutsInContainer: [] });
    return { pages, measurePages,
      async render(index, target) { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); const copy = svgs[index].cloneNode(true) as SVGElement; copy.style.width = '100%'; copy.style.height = '100%'; target.replaceChildren(copy); },
      dispose: cleanup,
    };
  } catch (error) { cleanup(); throw error; }
}
