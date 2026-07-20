interface BrewVisibilityBadgeProps {
  isPublic: boolean;
}

export function BrewVisibilityBadge({ isPublic }: BrewVisibilityBadgeProps) {
  const label = isPublic ? '공개 가게' : '비공개 가게';
  return (
    <span
      className={`brew-visibility ${isPublic ? 'brew-visibility--open' : 'brew-visibility--closed'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {isPublic ? (
        // 열린 자물쇠 (고리가 열려 있음)
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="7" width="8" height="6.5" rx="1.5" />
          <path d="M9 7V4.5a2.5 2.5 0 0 1 5 0V6" />
        </svg>
      ) : (
        // 닫힌 자물쇠
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="7" width="8" height="6.5" rx="1.5" />
          <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" />
        </svg>
      )}
    </span>
  );
}
