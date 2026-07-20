import type { AnnotationBrushSizes, AnnotationToolMode } from '../types/scoreAnnotation';
import { ANNOTATION_BRUSH_SIZE_LIMITS } from '../constants/annotationBrush';
import { useTranslation } from '../i18n/LanguageContext';

interface ScoreAnnotationToolbarProps {
  tool: AnnotationToolMode;
  brushSizes: AnnotationBrushSizes;
  onToolChange: (tool: AnnotationToolMode) => void;
  onBrushSizeChange: (tool: keyof AnnotationBrushSizes, size: number) => void;
  onClear: () => void;
  onUndo: () => void;
  visible: boolean;
}

export default function ScoreAnnotationToolbar({
  tool,
  brushSizes,
  onToolChange,
  onBrushSizeChange,
  onClear,
  onUndo,
  visible,
}: ScoreAnnotationToolbarProps) {
  const t = useTranslation();

  if (!visible) return null;

  const toolOptions: Array<{ id: AnnotationToolMode; label: string }> = [
    { id: 'none', label: t('annotation.scroll') },
    { id: 'pen', label: t('annotation.pen') },
    { id: 'highlighter', label: t('annotation.highlighter') },
    { id: 'eraser', label: t('annotation.eraser') },
  ];

  const sizeLabels: Record<keyof AnnotationBrushSizes, string> = {
    pen: t('annotation.penSize'),
    highlighter: t('annotation.highlighterSize'),
    eraser: t('annotation.eraserSize'),
  };

  const activeSizeKey =
    tool === 'pen' || tool === 'highlighter' || tool === 'eraser' ? tool : null;
  const activeLimits = activeSizeKey ? ANNOTATION_BRUSH_SIZE_LIMITS[activeSizeKey] : null;
  const activeSize = activeSizeKey ? brushSizes[activeSizeKey] : null;

  return (
    <div className="score-annotation-toolbar" aria-label={t('annotation.toolbarLabel')}>
      <div className="score-annotation-tool-group" role="tablist" aria-label={t('annotation.modeLabel')}>
        {toolOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tool === option.id}
            className={`score-annotation-tool-btn${tool === option.id ? ' active' : ''}`}
            onClick={() => onToolChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {activeSizeKey && activeLimits && activeSize !== null && (
        <label className="score-annotation-size-control">
          <span>{sizeLabels[activeSizeKey]}</span>
          <input
            type="range"
            min={activeLimits.min}
            max={activeLimits.max}
            step={activeLimits.step}
            value={activeSize}
            onChange={(event) => onBrushSizeChange(activeSizeKey, Number(event.target.value))}
          />
          <strong>{activeSize}px</strong>
        </label>
      )}

      <div className="score-annotation-tool-actions">
        <button type="button" className="score-annotation-action-btn" onClick={onUndo}>
          {t('annotation.undo')}
        </button>
        <button type="button" className="score-annotation-action-btn danger" onClick={onClear}>
          {t('annotation.clearAll')}
        </button>
      </div>
    </div>
  );
}

export function dispatchAnnotationClear(scoreId: string): void {
  window.dispatchEvent(new CustomEvent('score-annotations-clear', { detail: { scoreId } }));
}

export function dispatchAnnotationUndo(scoreId: string): void {
  window.dispatchEvent(new CustomEvent('score-annotations-undo', { detail: { scoreId } }));
}
