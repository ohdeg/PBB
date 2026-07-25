/** 레시피 노트용 구분점·순서 목록 + 들여쓰기 (Pages 스타일 plain text) */

const INDENT_UNIT = '  ';
const MAX_INDENT_LEVEL = 4;

const BULLET_MARKERS = ['•', '◦', '▪', '▫', '‣'] as const;
const LINE_RE = /^( *)(?:([•◦▪▫‣\-\*])|(\d+)\.)\s+(.*)$/;

export type NotesListKind = 'bullet' | 'numbered' | 'none';

export interface ParsedNotesLine {
  indent: number;
  kind: NotesListKind;
  marker: string;
  content: string;
  raw: string;
}

export function countIndentLevel(leadingSpaces: string): number {
  return Math.min(MAX_INDENT_LEVEL, Math.floor(leadingSpaces.length / INDENT_UNIT.length));
}

export function parseNotesLine(line: string): ParsedNotesLine {
  const match = line.match(LINE_RE);
  if (!match) {
    return {
      indent: 0,
      kind: 'none',
      marker: '',
      content: line,
      raw: line,
    };
  }
  const indent = countIndentLevel(match[1] ?? '');
  if (match[2]) {
    return {
      indent,
      kind: 'bullet',
      marker: match[2],
      content: match[4] ?? '',
      raw: line,
    };
  }
  return {
    indent,
    kind: 'numbered',
    marker: `${match[3]}.`,
    content: match[4] ?? '',
    raw: line,
  };
}

export function detectLineListKind(line: string): NotesListKind {
  return parseNotesLine(line).kind;
}

function bulletMarkerForLevel(level: number): string {
  const index = Math.min(level, BULLET_MARKERS.length - 1);
  return BULLET_MARKERS[index] ?? '•';
}

function formatListLine(indent: number, kind: NotesListKind, content: string, number = 1): string {
  const pad = INDENT_UNIT.repeat(Math.max(0, Math.min(indent, MAX_INDENT_LEVEL)));
  if (kind === 'bullet') {
    return `${pad}${bulletMarkerForLevel(indent)} ${content}`;
  }
  if (kind === 'numbered') {
    return `${pad}${number}. ${content}`;
  }
  return `${pad}${content}`;
}

function getLineRange(
  text: string,
  start: number,
  end: number,
): {
  lineStart: number;
  lineEnd: number;
  lines: string[];
} {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }
  const block = text.slice(lineStart, lineEnd);
  return {
    lineStart,
    lineEnd,
    lines: block.length === 0 ? [''] : block.split('\n'),
  };
}

export interface NotesTransformResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

function replaceLineBlock(
  text: string,
  lineStart: number,
  lineEnd: number,
  nextLines: string[],
): NotesTransformResult {
  const nextBlock = nextLines.join('\n');
  const nextText = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd);
  return {
    text: nextText,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}

export function toggleBulletOnSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): NotesTransformResult {
  const { lineStart, lineEnd, lines } = getLineRange(text, selectionStart, selectionEnd);
  const parsed = lines.map((line) => parseNotesLine(line));
  const allBullets = parsed.every((line) => line.kind === 'bullet');
  const nextLines = allBullets
    ? parsed.map((line) =>
        line.indent > 0
          ? `${INDENT_UNIT.repeat(line.indent)}${line.content}`
          : line.content,
      )
    : parsed.map((line) =>
        formatListLine(line.indent, 'bullet', line.kind === 'none' ? line.content : line.content),
      );
  return replaceLineBlock(text, lineStart, lineEnd, nextLines);
}

export function toggleNumberedOnSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): NotesTransformResult {
  const { lineStart, lineEnd, lines } = getLineRange(text, selectionStart, selectionEnd);
  const parsed = lines.map((line) => parseNotesLine(line));
  const allNumbered = parsed.every((line) => line.kind === 'numbered');
  if (allNumbered) {
    const nextLines = parsed.map((line) =>
      line.indent > 0
        ? `${INDENT_UNIT.repeat(line.indent)}${line.content}`
        : line.content,
    );
    return replaceLineBlock(text, lineStart, lineEnd, nextLines);
  }

  const counters = new Map<number, number>();
  const nextLines = parsed.map((line) => {
    const next = (counters.get(line.indent) ?? 0) + 1;
    counters.set(line.indent, next);
    return formatListLine(
      line.indent,
      'numbered',
      line.kind === 'none' ? line.content : line.content,
      next,
    );
  });
  return replaceLineBlock(text, lineStart, lineEnd, nextLines);
}

function renumberSiblingLines(lines: string[]): string[] {
  const counters = new Map<number, number>();
  return lines.map((line) => {
    const parsed = parseNotesLine(line);
    if (parsed.kind !== 'numbered') {
      if (parsed.kind === 'bullet') {
        return formatListLine(parsed.indent, 'bullet', parsed.content);
      }
      return line;
    }
    const next = (counters.get(parsed.indent) ?? 0) + 1;
    counters.set(parsed.indent, next);
    return formatListLine(parsed.indent, 'numbered', parsed.content, next);
  });
}

export function indentSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): NotesTransformResult {
  const { lineStart, lineEnd, lines } = getLineRange(text, selectionStart, selectionEnd);
  const nextLines = renumberSiblingLines(
    lines.map((line) => {
      const parsed = parseNotesLine(line);
      const nextIndent = Math.min(MAX_INDENT_LEVEL, parsed.indent + 1);
      if (parsed.kind === 'none') {
        return `${INDENT_UNIT.repeat(nextIndent)}${parsed.content}`;
      }
      if (parsed.kind === 'bullet') {
        return formatListLine(nextIndent, 'bullet', parsed.content);
      }
      return formatListLine(nextIndent, 'numbered', parsed.content, 1);
    }),
  );
  return replaceLineBlock(text, lineStart, lineEnd, nextLines);
}

export function outdentSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): NotesTransformResult {
  const { lineStart, lineEnd, lines } = getLineRange(text, selectionStart, selectionEnd);
  const nextLines = renumberSiblingLines(
    lines.map((line) => {
      const parsed = parseNotesLine(line);
      const nextIndent = Math.max(0, parsed.indent - 1);
      if (parsed.kind === 'none') {
        return nextIndent > 0
          ? `${INDENT_UNIT.repeat(nextIndent)}${parsed.content}`
          : parsed.content;
      }
      if (parsed.kind === 'bullet') {
        return formatListLine(nextIndent, 'bullet', parsed.content);
      }
      return formatListLine(nextIndent, 'numbered', parsed.content, 1);
    }),
  );
  return replaceLineBlock(text, lineStart, lineEnd, nextLines);
}

/** Enter 키로 목록 이어쓰기 / 빈 항목에서 한 단계 내어쓰기 또는 종료 */
export function continueListOnEnter(
  text: string,
  cursor: number,
): NotesTransformResult | null {
  const lineStart = text.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const line = text.slice(lineStart, cursor);
  const parsed = parseNotesLine(line);
  if (parsed.kind === 'none') {
    return null;
  }

  if (parsed.content.trim() === '') {
    if (parsed.indent > 0) {
      const nextLine = formatListLine(parsed.indent - 1, parsed.kind, '', 1);
      const nextText = text.slice(0, lineStart) + nextLine + text.slice(cursor);
      const nextCursor = lineStart + nextLine.length;
      return {
        text: nextText,
        selectionStart: nextCursor,
        selectionEnd: nextCursor,
      };
    }
    const nextText = text.slice(0, lineStart) + text.slice(cursor);
    return {
      text: nextText,
      selectionStart: lineStart,
      selectionEnd: lineStart,
    };
  }

  let number = 1;
  if (parsed.kind === 'numbered') {
    const match = parsed.marker.match(/^(\d+)\./);
    number = match ? Number(match[1]) + 1 : 1;
  }

  const nextPrefix = formatListLine(parsed.indent, parsed.kind, '', number);
  const insert = `\n${nextPrefix}`;
  const nextText = text.slice(0, cursor) + insert + text.slice(cursor);
  const nextCursor = cursor + insert.length;
  return {
    text: nextText,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
  };
}

export type NotesViewBlock =
  | { type: 'paragraph'; text: string }
  | {
      type: 'list';
      kind: 'bullet' | 'numbered';
      items: Array<{ indent: number; text: string }>;
    };

export function parseNotesToBlocks(notes: string): NotesViewBlock[] {
  const lines = notes.replace(/\r\n/g, '\n').split('\n');
  const blocks: NotesViewBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const parsed = parseNotesLine(line);

    if (parsed.kind === 'bullet' || parsed.kind === 'numbered') {
      const kind = parsed.kind;
      const items: Array<{ indent: number; text: string }> = [];
      while (i < lines.length) {
        const current = parseNotesLine(lines[i] ?? '');
        if (current.kind !== kind) {
          break;
        }
        items.push({ indent: current.indent, text: current.content });
        i += 1;
      }
      blocks.push({ type: 'list', kind, items });
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      parseNotesLine(lines[i] ?? '').kind === 'none'
    ) {
      para.push(lines[i] ?? '');
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }

  return blocks;
}
