import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { SrankoFitPart, SrankoSlot } from './types';

interface SrankoFitMapProps {
  slot: SrankoSlot;
  parts: SrankoFitPart[];
  /** Defaults to male right25 mannequin. */
  mannequinSrc?: string;
}

type FitStatus =
  | 'veryTight'
  | 'tight'
  | 'slightlyTight'
  | 'fit'
  | 'slightlyLoose'
  | 'loose'
  | 'veryLoose'
  | 'none';

interface StatusMeta {
  label: string;
  color: string;
  neutral: boolean;
}

const STATUS_META: Record<FitStatus, StatusMeta> = {
  veryTight: { label: '매우 타이트함', color: '#be123c', neutral: false },
  tight: { label: '타이트함', color: '#e11d48', neutral: false },
  slightlyTight: { label: '약간 타이트함', color: '#f0653a', neutral: false },
  fit: { label: '딱 맞음', color: '#1d1d1f', neutral: true },
  slightlyLoose: { label: '약간 루즈함', color: '#60a5fa', neutral: false },
  loose: { label: '루즈함', color: '#2563eb', neutral: false },
  veryLoose: { label: '매우 루즈함', color: '#1d4ed8', neutral: false },
  none: { label: '측정값 없음', color: '#9ca3af', neutral: true },
};

const PART_LABELS: Record<string, string> = {
  shoulder: '어깨',
  chest: '가슴',
  armLength: '소매',
  waist: '허리',
  hip: '엉덩이',
  thigh: '허벅지',
  legLength: '인심',
};

interface Point {
  x: number;
  y: number;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageLayout {
  clipLeft: number;
  clipTop: number;
  clipWidth: number;
  clipHeight: number;
  scale: number;
}

type MarkKind = 'curve' | 'length';

interface PartGeometry {
  key: string;
  calloutY: number;
  anchor: Point;
  mark: readonly Point[];
  markKind: MarkKind;
}

type VisualSlot = 'TOP' | 'BOTTOM' | 'DRESS';

interface SlotGeometry {
  ariaLabel: string;
  crop: CropRect;
  parts: readonly PartGeometry[];
}

interface RenderedPart {
  geometry: PartGeometry;
  part: SrankoFitPart;
  meta: StatusMeta;
}

const RIGHT_25_MANNEQUIN_URL = '/sranko/fit-mannequin-right25.webp';
// Geometry stays normalized to the 768×1024 right25 source, independent of slot crops.
const SOURCE_SIZE = { width: 768, height: 1024 } as const;

const SHOULDER_MARK: readonly Point[] = [
  { x: 0.37, y: 0.21 },
  { x: 0.36, y: 0.213 },
  { x: 0.425, y: 0.219 },
  { x: 0.48, y: 0.219 },
  { x: 0.655, y: 0.215 },
];

const CHEST_MARK: readonly Point[] = [
  { x: 0.37, y: 0.285 },
  { x: 0.41, y: 0.294 },
  { x: 0.455, y: 0.298 },
  { x: 0.5, y: 0.294 },
  { x: 0.59, y: 0.282 },
];

const TOP_CHEST_MARK: readonly Point[] = [
  { x: 0.385, y: 0.283 },
  { x: 0.38, y: 0.296 },
  { x: 0.43, y: 0.302 },
  { x: 0.48, y: 0.298 },
  { x: 0.596, y: 0.282 },
];

const WAIST_MARK: readonly Point[] = [
  { x: 0.39, y: 0.41 },
  { x: 0.43, y: 0.416 },
  { x: 0.475, y: 0.417 },
  { x: 0.52, y: 0.408 },
  { x: 0.584, y: 0.398 },
];

const HIP_MARK: readonly Point[] = [
  { x: 0.37, y: 0.485 },
  { x: 0.415, y: 0.5 },
  { x: 0.465, y: 0.507 },
  { x: 0.52, y: 0.5 },
  { x: 0.6, y: 0.482 },
];

const SLOT_GEOMETRY: Record<VisualSlot, SlotGeometry> = {
  TOP: {
    ariaLabel: '상의 부위별 핏',
    crop: { x: 0.1, y: 0.06, width: 0.64, height: 0.63 },
    parts: [
      {
        key: 'shoulder',
        calloutY: 0.16,
        anchor: { x: 0.37, y: 0.209 },
        mark: SHOULDER_MARK,
        markKind: 'curve',
      },
      {
        key: 'chest',
        calloutY: 0.37,
        anchor: { x: 0.385, y: 0.283 },
        mark: TOP_CHEST_MARK,
        markKind: 'curve',
      },
      {
        key: 'armLength',
        calloutY: 0.59,
        anchor: { x: 0.655, y: 0.515 },
        mark: [
          { x: 0.655, y: 0.218 },
          { x: 0.665, y: 0.285 },
          { x: 0.675, y: 0.36 },
          { x: 0.665, y: 0.43 },
          { x: 0.655, y: 0.515 },
        ],
        markKind: 'length',
      },
      {
        key: 'totalLength',
        calloutY: 0.81,
        anchor: { x: 0.445, y: 0.505 },
        mark: [
          { x: 0.49, y: 0.184 },
          { x: 0.47, y: 0.29 },
          { x: 0.455, y: 0.4 },
          { x: 0.445, y: 0.505 },
        ],
        markKind: 'length',
      },
    ],
  },
  BOTTOM: {
    ariaLabel: '하의 부위별 핏',
    crop: { x: 0.08, y: 0.34, width: 0.68, height: 0.64 },
    parts: [
      {
        key: 'waist',
        calloutY: 0.1,
        anchor: { x: 0.39, y: 0.41 },
        mark: WAIST_MARK,
        markKind: 'curve',
      },
      {
        key: 'hip',
        calloutY: 0.29,
        anchor: { x: 0.37, y: 0.485 },
        mark: HIP_MARK,
        markKind: 'curve',
      },
      {
        key: 'thigh',
        calloutY: 0.48,
        anchor: { x: 0.365, y: 0.555 },
        mark: [
          { x: 0.365, y: 0.555 },
          { x: 0.395, y: 0.564 },
          { x: 0.43, y: 0.565 },
          { x: 0.48, y: 0.553 },
        ],
        markKind: 'curve',
      },
      {
        key: 'legLength',
        calloutY: 0.68,
        anchor: { x: 0.5, y: 0.89 },
        mark: [
          { x: 0.46, y: 0.525 },
          { x: 0.49, y: 0.64 },
          { x: 0.515, y: 0.76 },
          { x: 0.5, y: 0.89 },
        ],
        markKind: 'length',
      },
      {
        key: 'totalLength',
        calloutY: 0.87,
        anchor: { x: 0.57, y: 0.89 },
        mark: [
          { x: 0.57, y: 0.4 },
          { x: 0.585, y: 0.62 },
          { x: 0.59, y: 0.75 },
          { x: 0.59, y: 0.82 },
          { x: 0.57, y: 0.89 },
        ],
        markKind: 'length',
      },
    ],
  },
  DRESS: {
    ariaLabel: '원피스 부위별 핏',
    crop: { x: 0.1, y: 0.03, width: 0.64, height: 0.95 },
    parts: [
      {
        key: 'shoulder',
        calloutY: 0.08,
        anchor: { x: 0.37, y: 0.209 },
        mark: SHOULDER_MARK,
        markKind: 'curve',
      },
      {
        key: 'chest',
        calloutY: 0.23,
        anchor: { x: 0.37, y: 0.285 },
        mark: CHEST_MARK,
        markKind: 'curve',
      },
      {
        key: 'armLength',
        calloutY: 0.38,
        anchor: { x: 0.655, y: 0.515 },
        mark: [
          { x: 0.655, y: 0.215 },
          { x: 0.665, y: 0.285 },
          { x: 0.675, y: 0.36 },
          { x: 0.665, y: 0.43 },
          { x: 0.655, y: 0.515 },
        ],
        markKind: 'length',
      },
      {
        key: 'waist',
        calloutY: 0.53,
        anchor: { x: 0.39, y: 0.41 },
        mark: WAIST_MARK,
        markKind: 'curve',
      },
      {
        key: 'hip',
        calloutY: 0.68,
        anchor: { x: 0.37, y: 0.485 },
        mark: HIP_MARK,
        markKind: 'curve',
      },
      {
        key: 'totalLength',
        calloutY: 0.84,
        anchor: { x: 0.535, y: 0.89 },
        mark: [
          { x: 0.445, y: 0.185 },
          { x: 0.465, y: 0.35 },
          { x: 0.49, y: 0.53 },
          { x: 0.515, y: 0.71 },
          { x: 0.535, y: 0.89 },
        ],
        markKind: 'length',
      },
    ],
  },
};

function statusOf(part: SrankoFitPart): FitStatus {
  if (part.deltaCm !== null) {
    const delta = part.deltaCm;
    if (delta <= -8) return 'veryTight';
    if (delta <= -4) return 'tight';
    if (delta <= -2) return 'slightlyTight';
    if (delta <= 4) return 'fit';
    if (delta <= 8) return 'slightlyLoose';
    if (delta <= 12) return 'loose';
    return 'veryLoose';
  }
  if (part.band === 'small') return 'tight';
  if (part.band === 'ok') return 'fit';
  if (part.band === 'large') return 'loose';
  return 'none';
}

function partLabel(slot: SrankoSlot, key: string): string {
  if (key === 'totalLength') {
    return slot === 'BOTTOM' ? '기장' : '총장';
  }
  if (key === 'armLength') {
    return '소매';
  }
  return PART_LABELS[key] ?? key;
}

function fitCropToStage(width: number, height: number, crop: CropRect): ImageLayout {
  const cropWidth = crop.width * SOURCE_SIZE.width;
  const cropHeight = crop.height * SOURCE_SIZE.height;
  const scale = Math.min(width / cropWidth, height / cropHeight);
  const clipWidth = cropWidth * scale;
  const clipHeight = cropHeight * scale;

  return {
    clipLeft: width - clipWidth,
    clipTop: (height - clipHeight) / 2,
    clipWidth,
    clipHeight,
    scale,
  };
}

function sourcePoint(point: Point, crop: CropRect, layout: ImageLayout): Point {
  return {
    x: layout.clipLeft + (point.x - crop.x) * SOURCE_SIZE.width * layout.scale,
    y: layout.clipTop + (point.y - crop.y) * SOURCE_SIZE.height * layout.scale,
  };
}

function drawSmoothMark(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  crop: CropRect,
  layout: ImageLayout,
): void {
  const scaled = points.map((point) => sourcePoint(point, crop, layout));
  const first = scaled[0];
  if (!first) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (let index = 1; index < scaled.length - 1; index += 1) {
    const current = scaled[index];
    const next = scaled[index + 1];
    if (!current || !next) continue;
    context.quadraticCurveTo(
      current.x,
      current.y,
      (current.x + next.x) / 2,
      (current.y + next.y) / 2,
    );
  }
  const last = scaled.at(-1);
  if (last) context.lineTo(last.x, last.y);
  context.stroke();
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  imageClip: HTMLDivElement,
  image: HTMLImageElement,
  crop: CropRect,
  rendered: readonly RenderedPart[],
): void {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext('2d');
  if (!context) return;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const layout = fitCropToStage(bounds.width, bounds.height, crop);
  imageClip.style.left = `${layout.clipLeft}px`;
  imageClip.style.top = `${layout.clipTop}px`;
  imageClip.style.width = `${layout.clipWidth}px`;
  imageClip.style.height = `${layout.clipHeight}px`;
  image.style.left = `${-crop.x * SOURCE_SIZE.width * layout.scale}px`;
  image.style.top = `${-crop.y * SOURCE_SIZE.height * layout.scale}px`;
  image.style.width = `${SOURCE_SIZE.width * layout.scale}px`;
  image.style.height = `${SOURCE_SIZE.height * layout.scale}px`;

  rendered.forEach(({ geometry, meta }) => {
    const anchor = sourcePoint(geometry.anchor, crop, layout);
    const leaderY = geometry.calloutY * bounds.height;
    const leaderStartX = bounds.width * 0.335;
    const leaderElbowX = bounds.width * 0.38;

    context.strokeStyle = '#cbd1d8';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(leaderStartX, leaderY);
    context.lineTo(leaderElbowX, leaderY);
    context.lineTo(leaderElbowX, anchor.y);
    context.lineTo(anchor.x, anchor.y);
    context.stroke();

    context.strokeStyle = meta.color;
    context.lineWidth = geometry.markKind === 'curve' ? 2.25 : 2;
    drawSmoothMark(context, geometry.mark, crop, layout);

    context.fillStyle = meta.color;
    context.beginPath();
    context.arc(anchor.x, anchor.y, 2.75, 0, Math.PI * 2);
    context.fill();
  });
}

export function SrankoFitMap({
  slot,
  parts,
  mannequinSrc = RIGHT_25_MANNEQUIN_URL,
}: SrankoFitMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageClipRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const visualSlot: VisualSlot =
    slot === 'BOTTOM' ? 'BOTTOM' : slot === 'DRESS' ? 'DRESS' : 'TOP';
  const geometry = SLOT_GEOMETRY[visualSlot];
  const rendered = useMemo<RenderedPart[]>(
    () =>
      geometry.parts.flatMap((partGeometry) => {
        const part = parts.find((candidate) => candidate.key === partGeometry.key);
        return part
          ? [{ geometry: partGeometry, part, meta: STATUS_META[statusOf(part)] }]
          : [];
      }),
    [geometry, parts],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const imageClip = imageClipRef.current;
    const image = imageRef.current;
    if (!canvas || !stage || !imageClip || !image) return undefined;

    const redraw = (): void =>
      drawCanvas(canvas, imageClip, image, geometry.crop, rendered);
    redraw();
    image.addEventListener('load', redraw);
    const observer = new ResizeObserver(redraw);
    observer.observe(stage);
    return () => {
      image.removeEventListener('load', redraw);
      observer.disconnect();
    };
  }, [geometry.crop, rendered, mannequinSrc]);

  if (
    slot === 'SHOES' ||
    slot === 'HAT' ||
    slot === 'BAG' ||
    slot === 'JEWELRY' ||
    parts.length === 0 ||
    rendered.length === 0
  ) {
    return null;
  }

  const summary = rendered
    .map(({ part, meta }) => `${partLabel(slot, part.key)} ${meta.label}`)
    .join(', ');

  return (
    <section
      className={`sranko-fitmap sranko-fitmap--${visualSlot.toLowerCase()}`}
      role="group"
      aria-label={`${geometry.ariaLabel}: ${summary}`}
    >
      <span className="sranko-fitmap__title">부위별 핏</span>
      <div ref={stageRef} className="sranko-fitmap__stage">
        <div
          ref={imageClipRef}
          className="sranko-fitmap__image-clip"
          aria-hidden="true"
        >
          <img
            ref={imageRef}
            className="sranko-fitmap__mannequin"
            src={mannequinSrc}
            alt=""
          />
        </div>
        <canvas ref={canvasRef} className="sranko-fitmap__canvas" aria-hidden="true" />
        <div className="sranko-fitmap__callouts">
          {rendered.map(({ geometry: partGeometry, part, meta }) => (
            <div
              className="sranko-fitmap__callout"
              key={part.key}
              style={{ top: `${partGeometry.calloutY * 100}%` }}
            >
              <span className="sranko-fitmap__part">{partLabel(slot, part.key)}</span>
              <span
                className={`sranko-fitmap__pill${meta.neutral ? ' is-neutral' : ''}`}
                style={{ '--fit-color': meta.color } as CSSProperties}
              >
                {meta.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="sranko-fitmap__hint">
        사진은 분위기 컷이에요. 정확한 핏은 위 마네킹을 참고하세요.
      </p>
    </section>
  );
}
