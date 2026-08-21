import { create } from 'zustand';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pbb-theme';

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // private mode
    }
    applyTheme(theme);
    set({ theme });
  },
}));
