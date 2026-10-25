import {
  collectUnifiedMeasureGroups,
  parseMusicXmlDocument,
} from './musicXmlMeasures';

export interface MeasureRepeatMeta {
  sourceIndex: number;
  forwardRepeat: boolean;
  backwardRepeat: boolean;
  repeatTimes: number;
  activeEndings: number[];
  segnoId: string | null;
  codaId: string | null;
  jumpDacapo: boolean;
  jumpDalsegno: boolean;
  jumpTocoda: boolean;
  jumpDalsegnoTarget: string | null;
  jumpTocodaTarget: string | null;
  isFine: boolean;
}

interface RepeatFrame {
  startIndex: number;
  pass: number;
  maxPasses: number;
  backwardIndex: number;
}

interface NavigationSignals {
  segnoId: string | null;
  codaId: string | null;
  jumpDacapo: boolean;
  jumpDalsegno: boolean;
  jumpTocoda: boolean;
  jumpDalsegnoTarget: string | null;
  jumpTocodaTarget: string | null;
  isFine: boolean;
}

const DEFAULT_MARKER_ID = 'default';

function parseEndingNumbers(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function hasElement(measure: Element, selector: string): boolean {
  return measure.querySelector(selector) !== null;
}

function getSoundJumpTarget(measure: Element, attribute: 'dalsegno' | 'tocoda'): string | null {
  const sounds = measure.querySelectorAll('direction sound');
  for (let soundIndex = 0; soundIndex < sounds.length; soundIndex += 1) {
    const value = sounds[soundIndex].getAttribute(attribute);
    if (value && value.length > 0 && value.toLowerCase() !== 'no') {
      return value;
    }
  }
  return null;
}

function hasSoundAttribute(measure: Element, attribute: string): boolean {
  const sounds = measure.querySelectorAll('direction sound');
  for (let soundIndex = 0; soundIndex < sounds.length; soundIndex += 1) {
    const value = sounds[soundIndex].getAttribute(attribute);
    if (value && value.length > 0 && value.toLowerCase() !== 'no') {
      return true;
    }
  }
  return false;
}

function getMarkerIdFromMeasure(measure: Element, marker: 'segno' | 'coda'): string | null {
  const barlineMarker = measure.querySelector(`barline ${marker}`);
  if (barlineMarker) {
    return barlineMarker.getAttribute('id') ?? barlineMarker.getAttribute('number') ?? DEFAULT_MARKER_ID;
  }

  const directionMarker = measure.querySelector(`direction ${marker}, direction-type ${marker}`);
  if (directionMarker) {
    return directionMarker.getAttribute('id') ?? directionMarker.getAttribute('number') ?? DEFAULT_MARKER_ID;
  }

  const sounds = measure.querySelectorAll('direction sound');
  for (let soundIndex = 0; soundIndex < sounds.length; soundIndex += 1) {
    const sound = sounds[soundIndex];
    const markerValue = sound.getAttribute(marker);
    const jumpAttribute = marker === 'segno' ? 'dalsegno' : 'tocoda';
    const jumpValue = sound.getAttribute(jumpAttribute);
    if (markerValue && markerValue.length > 0 && !jumpValue) {
      return markerValue;
    }
  }

  return null;
}

function collectMeasureText(measure: Element): string {
  const chunks: string[] = [];
  measure.querySelectorAll('direction').forEach((direction) => {
    const text = direction.textContent?.trim();
    if (text) {
      chunks.push(text);
    }
  });
  return chunks.join(' ');
}

function detectNavigationSignals(measure: Element): NavigationSignals {
  const text = collectMeasureText(measure);
  const lowerText = text.toLowerCase();

  const fromSound = {
    jumpDacapo: hasSoundAttribute(measure, 'dacapo'),
    jumpDalsegno: hasSoundAttribute(measure, 'dalsegno'),
    jumpTocoda: hasSoundAttribute(measure, 'tocoda'),
    jumpDalsegnoTarget: getSoundJumpTarget(measure, 'dalsegno'),
    jumpTocodaTarget: getSoundJumpTarget(measure, 'tocoda'),
    isFine: hasSoundAttribute(measure, 'fine') || hasElement(measure, 'barline[fine="yes"]'),
  };

  const fromElements = {
    segnoId: getMarkerIdFromMeasure(measure, 'segno'),
    codaId: getMarkerIdFromMeasure(measure, 'coda'),
  };

  const hasDalSegnoText = /\bd\.?\s*s\.?\b/i.test(text) || /dal\s*segno/i.test(lowerText);
  const hasDalCapoText = /\bd\.?\s*c\.?\b/i.test(text) || /da\s*capo/i.test(lowerText);
  const hasToCodaText = /to\s*coda/i.test(lowerText);
  const hasFineText = /\bfine\b/i.test(lowerText) || /al\s*fine/i.test(lowerText);
  const hasSegnoText = /\bsegno\b/i.test(lowerText) || text.includes('𝄋');
  const hasCodaText =
    (/\bcoda\b/i.test(lowerText) || text.includes('𝄌')) && !hasToCodaText;

  return {
    segnoId: fromElements.segnoId ?? (hasSegnoText && !hasDalSegnoText ? DEFAULT_MARKER_ID : null),
    codaId: fromElements.codaId ?? (hasCodaText ? DEFAULT_MARKER_ID : null),
    jumpDacapo: fromSound.jumpDacapo || hasDalCapoText,
    jumpDalsegno: fromSound.jumpDalsegno || hasDalSegnoText,
    jumpTocoda: fromSound.jumpTocoda || hasToCodaText,
    jumpDalsegnoTarget: fromSound.jumpDalsegnoTarget,
    jumpTocodaTarget: fromSound.jumpTocodaTarget,
    isFine: fromSound.isFine || hasFineText,
  };
}

function parseBarlinesFromMeasureGroup(measureElements: Element[]): {
  forwardRepeat: boolean;
  backwardRepeat: boolean;
  repeatTimes: number;
  endingEvents: Array<{ type: string; numbers: number[]; location: string | null }>;
} {
  let forwardRepeat = false;
  let backwardRepeat = false;
  let repeatTimes = 2;
  const endingEvents: Array<{ type: string; numbers: number[]; location: string | null }> = [];

  measureElements.forEach((measureElement) => {
    measureElement.querySelectorAll('barline').forEach((barline) => {
      const repeat = barline.querySelector('repeat');
      if (repeat) {
        const direction = repeat.getAttribute('direction');
        const times = Number(repeat.getAttribute('times') ?? '2');
        if (direction === 'forward') {
          forwardRepeat = true;
        }
        if (direction === 'backward') {
          backwardRepeat = true;
          if (Number.isFinite(times) && times > 1) {
            repeatTimes = times;
          }
        }
      }

      const ending = barline.querySelector('ending');
      if (ending) {
        const type = ending.getAttribute('type');
        const numbers = parseEndingNumbers(ending.getAttribute('number'));
        const location = barline.getAttribute('location');
        if (type) {
          endingEvents.push({ type, numbers, location });
        }
      }
    });
  });

  return { forwardRepeat, backwardRepeat, repeatTimes, endingEvents };
}

function parseNavigationFromMeasureGroup(measureElements: Element[]): NavigationSignals {
  const merged: NavigationSignals = {
    segnoId: null,
    codaId: null,
    jumpDacapo: false,
    jumpDalsegno: false,
    jumpTocoda: false,
    jumpDalsegnoTarget: null,
    jumpTocodaTarget: null,
    isFine: false,
  };

  measureElements.forEach((measureElement) => {
    const signals = detectNavigationSignals(measureElement);
    if (signals.segnoId) merged.segnoId = signals.segnoId;
    if (signals.codaId) merged.codaId = signals.codaId;
    merged.jumpDacapo = merged.jumpDacapo || signals.jumpDacapo;
    merged.jumpDalsegno = merged.jumpDalsegno || signals.jumpDalsegno;
    merged.jumpTocoda = merged.jumpTocoda || signals.jumpTocoda;
    merged.isFine = merged.isFine || signals.isFine;
    if (signals.jumpDalsegnoTarget) merged.jumpDalsegnoTarget = signals.jumpDalsegnoTarget;
    if (signals.jumpTocodaTarget) merged.jumpTocodaTarget = signals.jumpTocodaTarget;
  });

  return merged;
}

function applyEndingRemoval(activeEndings: number[], numbers: number[]) {
  if (numbers.length > 0) {
    numbers.forEach((number) => {
      const removeIndex = activeEndings.lastIndexOf(number);
      if (removeIndex >= 0) {
        activeEndings.splice(removeIndex, 1);
      } else {
        activeEndings.pop();
      }
    });
    return;
  }

  activeEndings.pop();
}

export function parseMeasureRepeatMetas(musicXmlText: string): MeasureRepeatMeta[] {
  const xmlDoc = parseMusicXmlDocument(musicXmlText);
  const measureGroups = collectUnifiedMeasureGroups(xmlDoc);
  const activeEndings: number[] = [];

  return measureGroups.map((group) => {
    const barlines = parseBarlinesFromMeasureGroup(group.elements);
    const navigation = parseNavigationFromMeasureGroup(group.elements);

    barlines.endingEvents
      .filter((endingEvent) => endingEvent.type === 'start' && endingEvent.location !== 'right')
      .forEach((endingEvent) => {
        endingEvent.numbers.forEach((number) => activeEndings.push(number));
      });

    barlines.endingEvents
      .filter(
        (endingEvent) =>
          (endingEvent.type === 'stop' || endingEvent.type === 'discontinue') &&
          endingEvent.location === 'left',
      )
      .forEach((endingEvent) => {
        applyEndingRemoval(activeEndings, endingEvent.numbers);
      });

    const activeEndingsForCurrentMeasure = [...activeEndings];

    barlines.endingEvents
      .filter((endingEvent) => endingEvent.type === 'stop' || endingEvent.type === 'discontinue')
      .forEach((endingEvent) => {
        if (endingEvent.location === 'left') return;
        applyEndingRemoval(activeEndings, endingEvent.numbers);
      });

    barlines.endingEvents
      .filter((endingEvent) => endingEvent.type === 'start' && endingEvent.location === 'right')
      .forEach((endingEvent) => {
        endingEvent.numbers.forEach((number) => activeEndings.push(number));
      });

    return {
      sourceIndex: group.measureIndex,
      forwardRepeat: barlines.forwardRepeat,
      backwardRepeat: barlines.backwardRepeat,
      repeatTimes: barlines.repeatTimes,
      activeEndings: activeEndingsForCurrentMeasure,
      segnoId: navigation.segnoId,
      codaId: navigation.codaId,
      jumpDacapo: navigation.jumpDacapo,
      jumpDalsegno: navigation.jumpDalsegno,
      jumpTocoda: navigation.jumpTocoda,
      jumpDalsegnoTarget: navigation.jumpDalsegnoTarget,
      jumpTocodaTarget: navigation.jumpTocodaTarget,
      isFine: navigation.isFine,
    };
  });
}

function findRepeatStart(metas: MeasureRepeatMeta[], backwardIndex: number): number {
  for (let index = backwardIndex; index >= 0; index -= 1) {
    if (metas[index].forwardRepeat) {
      return index;
    }
  }
  return 0;
}

function shouldIncludeMeasure(meta: MeasureRepeatMeta, pass: number): boolean {
  if (meta.activeEndings.length === 0) {
    return true;
  }
  return meta.activeEndings.includes(pass);
}

function buildMarkerIndexMap(
  metas: MeasureRepeatMeta[],
  key: 'segnoId' | 'codaId',
): Map<string, number> {
  const markerMap = new Map<string, number>();
  metas.forEach((meta, index) => {
    const markerId = meta[key];
    if (markerId && !markerMap.has(markerId)) {
      markerMap.set(markerId, index);
    }
  });
  return markerMap;
}

function resolveMarkerIndex(
  markerMap: Map<string, number>,
  target: string | null,
): number | null {
  if (markerMap.size === 0) return null;
  if (target) {
    const resolved = markerMap.get(target);
    if (resolved !== undefined) return resolved;
  }
  const firstEntry = markerMap.entries().next().value;
  return firstEntry ? firstEntry[1] : null;
}

function skipAlternateEndings(metas: MeasureRepeatMeta[], startIndex: number, pass: number): number {
  let index = startIndex;
  while (index < metas.length) {
    const meta = metas[index];
    if (meta.activeEndings.length === 0) {
      break;
    }
    if (meta.activeEndings.includes(pass)) {
      break;
    }
    index += 1;
  }
  return index;
}

function shouldStopAtFine(
  hasGlobalJump: boolean,
  dacapoUsed: boolean,
  dalsegnoUsed: boolean,
): boolean {
  if (!hasGlobalJump) return true;
  return dacapoUsed || dalsegnoUsed;
}

function shouldGateCodaBeforeActivation(
  hasCodaNavigation: boolean,
  dacapoUsed: boolean,
  dalsegnoUsed: boolean,
): boolean {
  if (!hasCodaNavigation) return false;
  return dacapoUsed || dalsegnoUsed;
}

export function expandPlaybackSequence(metas: MeasureRepeatMeta[]): number[] {
  if (metas.length === 0) {
    return [];
  }

  const sequence: number[] = [];
  const repeatStack: RepeatFrame[] = [];
  const segnoMap = buildMarkerIndexMap(metas, 'segnoId');
  const codaMap = buildMarkerIndexMap(metas, 'codaId');
  const defaultCodaIndex = resolveMarkerIndex(codaMap, null);
  const hasGlobalJump = metas.some((meta) => meta.jumpDacapo || meta.jumpDalsegno);
  const hasCodaNavigation = metas.some((meta) => meta.jumpTocoda);

  let dacapoUsed = false;
  let dalsegnoUsed = false;
  let codaActive = false;
  let index = 0;
  // After a repeat frame finishes, the alternate ending (e.g. 2nd volta) plays on
  // the final pass. The repeat stack is already empty by then, so we carry the
  // ending pass here until we leave the ending region.
  let pendingEndingPass: number | null = null;
  let safetyCounter = 0;
  const safetyLimit = Math.max(metas.length * 32, 512);

  while (index < metas.length && safetyCounter < safetyLimit) {
    safetyCounter += 1;
    if (
      defaultCodaIndex !== null &&
      index >= defaultCodaIndex &&
      !codaActive &&
      shouldGateCodaBeforeActivation(hasCodaNavigation, dacapoUsed, dalsegnoUsed)
    ) {
      index += 1;
      continue;
    }

    const meta = metas[index];
    if (meta.activeEndings.length === 0) {
      pendingEndingPass = null;
    }
    const pass =
      repeatStack.length > 0
        ? repeatStack[repeatStack.length - 1].pass
        : (pendingEndingPass ?? 1);

    if (shouldIncludeMeasure(meta, pass)) {
      sequence.push(index);
    }

    if (meta.isFine && shouldStopAtFine(hasGlobalJump, dacapoUsed, dalsegnoUsed)) {
      break;
    }

    if (meta.jumpDacapo && !dacapoUsed) {
      dacapoUsed = true;
      dalsegnoUsed = false;
      codaActive = false;
      repeatStack.length = 0;
      index = 0;
      continue;
    }

    if (meta.jumpDalsegno) {
      const segnoIndex = resolveMarkerIndex(segnoMap, meta.jumpDalsegnoTarget);
      if (segnoIndex !== null && !dalsegnoUsed) {
        dalsegnoUsed = true;
        index = segnoIndex;
        continue;
      }
    }

    if (meta.jumpTocoda) {
      const codaIndex = resolveMarkerIndex(codaMap, meta.jumpTocodaTarget);
      if (codaIndex !== null && (dalsegnoUsed || dacapoUsed)) {
        codaActive = true;
        index = codaIndex;
        continue;
      }
    }

    if (meta.backwardRepeat) {
      let frame = repeatStack[repeatStack.length - 1];
      if (!frame || frame.backwardIndex !== index) {
        frame = {
          startIndex: findRepeatStart(metas, index),
          pass: 1,
          maxPasses: meta.repeatTimes,
          backwardIndex: index,
        };
        repeatStack.push(frame);
      }

      if (frame.pass < frame.maxPasses) {
        frame.pass += 1;
        index = frame.startIndex;
        continue;
      }

      repeatStack.pop();
      index += 1;
      index = skipAlternateEndings(metas, index, meta.repeatTimes);
      pendingEndingPass = meta.repeatTimes;
      continue;
    }

    index += 1;
  }

  return sequence;
}

export function parsePlaybackSequenceFromMusicXml(musicXmlText: string): number[] {
  const metas = parseMeasureRepeatMetas(musicXmlText);
  const sequence = expandPlaybackSequence(metas);
  if (sequence.length > 0) {
    return sequence;
  }
  return metas.map((meta) => meta.sourceIndex);
}
