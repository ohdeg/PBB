import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  continueListOnEnter,
  indentSelection,
  outdentSelection,
  toggleBulletOnSelection,
  toggleNumberedOnSelection,
} from './vevenoNotesList';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';

interface VevenoRecipeNotesEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function VevenoRecipeNotesEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  disabled = false,
}: VevenoRecipeNotesEditorProps) {
  const t = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('recipe.notesPlaceholder');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    const el = textareaRef.current;
    if (!pending || !el) {
      return;
    }
    el.focus();
    el.setSelectionRange(pending.start, pending.end);
    pendingSelectionRef.current = null;
  }, [value]);

  const applyTransform = (
    transform: (
      text: string,
      start: number,
      end: number,
    ) => { text: string; selectionStart: number; selectionEnd: number },
  ) => {
    const el = textareaRef.current;
    if (!el || disabled) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const result = transform(value, start, end);
    pendingSelectionRef.current = {
      start: result.selectionStart,
      end: result.selectionEnd,
    };
    onChange(result.text);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      applyTransform(event.shiftKey ? outdentSelection : indentSelection);
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    const el = textareaRef.current;
    if (!el || el.selectionStart !== el.selectionEnd) {
      return;
    }
    const result = continueListOnEnter(value, el.selectionStart);
    if (!result) {
      return;
    }
    event.preventDefault();
    pendingSelectionRef.current = {
      start: result.selectionStart,
      end: result.selectionEnd,
    };
    onChange(result.text);
  };

  return (
    <div className="veveno-notes-editor">
      <div className="veveno-notes-toolbar" role="toolbar" aria-label={t('recipe.toolbarAria')}>
        <button
          type="button"
          className="veveno-notes-toolbar__btn"
          disabled={disabled}
          title={t('recipe.bulletsTitle')}
          aria-label={t('recipe.bulletsTitle')}
          onClick={() => applyTransform(toggleBulletOnSelection)}
        >
          <span aria-hidden>•</span>
          <span>{t('recipe.bullets')}</span>
        </button>
        <button
          type="button"
          className="veveno-notes-toolbar__btn"
          disabled={disabled}
          title={t('recipe.numberedTitle')}
          aria-label={t('recipe.numberedTitle')}
          onClick={() => applyTransform(toggleNumberedOnSelection)}
        >
          <span aria-hidden>1.</span>
          <span>{t('recipe.numbered')}</span>
        </button>
        <button
          type="button"
          className="veveno-notes-toolbar__btn"
          disabled={disabled}
          title={t('recipe.indentTitle')}
          aria-label={t('recipe.indent')}
          onClick={() => applyTransform(indentSelection)}
        >
          <span aria-hidden>→</span>
          <span>{t('recipe.indent')}</span>
        </button>
        <button
          type="button"
          className="veveno-notes-toolbar__btn"
          disabled={disabled}
          title={t('recipe.outdentTitle')}
          aria-label={t('recipe.outdent')}
          onClick={() => applyTransform(outdentSelection)}
        >
          <span aria-hidden>←</span>
          <span>{t('recipe.outdent')}</span>
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        className="veveno-field__input veveno-field__textarea veveno-notes-editor__textarea"
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        aria-labelledby={id ? `${id}-label` : undefined}
      />
    </div>
  );
}
