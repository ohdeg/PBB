import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  continueListOnEnter,
  indentSelection,
  outdentSelection,
  toggleBulletOnSelection,
  toggleNumberedOnSelection,
} from './brewNotesList';

interface BrewRecipeNotesEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function BrewRecipeNotesEditor({
  id,
  value,
  onChange,
  placeholder = '추출·원두·테이스팅 메모',
  rows = 8,
  disabled = false,
}: BrewRecipeNotesEditorProps) {
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
    <div className="brew-notes-editor">
      <div className="brew-notes-toolbar" role="toolbar" aria-label="노트 목록 서식">
        <button
          type="button"
          className="brew-notes-toolbar__btn"
          disabled={disabled}
          title="구분점 목록"
          aria-label="구분점 목록"
          onClick={() => applyTransform(toggleBulletOnSelection)}
        >
          <span aria-hidden>•</span>
          <span>구분점</span>
        </button>
        <button
          type="button"
          className="brew-notes-toolbar__btn"
          disabled={disabled}
          title="번호 목록"
          aria-label="번호 목록"
          onClick={() => applyTransform(toggleNumberedOnSelection)}
        >
          <span aria-hidden>1.</span>
          <span>목록</span>
        </button>
        <button
          type="button"
          className="brew-notes-toolbar__btn"
          disabled={disabled}
          title="들여쓰기 (Tab)"
          aria-label="들여쓰기"
          onClick={() => applyTransform(indentSelection)}
        >
          <span aria-hidden>→</span>
          <span>들여쓰기</span>
        </button>
        <button
          type="button"
          className="brew-notes-toolbar__btn"
          disabled={disabled}
          title="내어쓰기 (Shift+Tab)"
          aria-label="내어쓰기"
          onClick={() => applyTransform(outdentSelection)}
        >
          <span aria-hidden>←</span>
          <span>내어쓰기</span>
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        className="brew-field__input brew-field__textarea brew-notes-editor__textarea"
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-labelledby={id ? `${id}-label` : undefined}
      />
    </div>
  );
}
