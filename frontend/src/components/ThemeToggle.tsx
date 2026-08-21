import { useThemeStore } from '../stores/themeStore';

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={dark ? '라이트 모드' : '다크 모드'}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16.4 13.2A6.6 6.6 0 0 1 10.8 4.4a.75.75 0 0 0-.95-.95 8.1 8.1 0 1 0 10.7 10.7.75.75 0 0 0-.95-.95 6.56 6.56 0 0 1-5.2 0Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 4.2a.9.9 0 0 1 .9.9v1.2a.9.9 0 1 1-1.8 0V5.1a.9.9 0 0 1 .9-.9Zm0 12.6a4.8 4.8 0 1 1 0-9.6 4.8 4.8 0 0 1 0 9.6Zm7.1-5.7h1.2a.9.9 0 1 1 0 1.8h-1.2a.9.9 0 1 1 0-1.8ZM4.2 11.1H3a.9.9 0 1 0 0 1.8h1.2a.9.9 0 1 0 0-1.8Zm12.7-5.3.85-.85a.9.9 0 1 1 1.27 1.27l-.85.85A.9.9 0 1 1 16.9 5.8Zm-10.07 10.07-.85.85a.9.9 0 1 1-1.27-1.27l.85-.85a.9.9 0 0 1 1.27 1.27Zm10.07 0a.9.9 0 0 1 1.27 0l.85.85a.9.9 0 1 1-1.27 1.27l-.85-.85a.9.9 0 0 1 0-1.27ZM6.83 5.8a.9.9 0 0 1 0 1.27l-.85.85A.9.9 0 1 1 4.7 6.65l.85-.85A.9.9 0 0 1 6.83 5.8ZM12 17.7a.9.9 0 0 1 .9.9v1.2a.9.9 0 1 1-1.8 0v-1.2a.9.9 0 0 1 .9-.9Z"
          />
        </svg>
      )}
    </button>
  );
}
