import { parseNotesToBlocks } from './vevenoNotesList';

interface VevenoRecipeNotesViewProps {
  notes: string;
}

const BULLET_MARKERS = ['•', '◦', '▪', '▫', '‣'] as const;

function bulletMarker(level: number): string {
  return BULLET_MARKERS[Math.min(level, BULLET_MARKERS.length - 1)] ?? '•';
}

export function VevenoRecipeNotesView({ notes }: VevenoRecipeNotesViewProps) {
  const blocks = parseNotesToBlocks(notes);

  if (blocks.length === 0) {
    return <p className="veveno-empty">노트가 없습니다.</p>;
  }

  return (
    <div className="veveno-recipe-view__notes">
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={`p-${index}`} className="veveno-notes-paragraph">
              {block.text}
            </p>
          );
        }

        const counters = new Map<number, number>();
        return (
          <ul
            key={`list-${index}`}
            className={`veveno-notes-list veveno-notes-list--${block.kind}`}
          >
            {block.items.map((item, itemIndex) => {
              const level = item.indent;
              let marker = bulletMarker(level);
              if (block.kind === 'numbered') {
                const next = (counters.get(level) ?? 0) + 1;
                counters.set(level, next);
                marker = `${next}.`;
              }
              return (
                <li
                  key={`list-${index}-${itemIndex}`}
                  className={`veveno-notes-item veveno-notes-item--level-${level}`}
                  style={{ ['--notes-indent' as string]: String(level) }}
                >
                  <span className="veveno-notes-item__marker" aria-hidden>
                    {marker}
                  </span>
                  <span className="veveno-notes-item__text">{item.text || '\u00A0'}</span>
                </li>
              );
            })}
          </ul>
        );
      })}
    </div>
  );
}
