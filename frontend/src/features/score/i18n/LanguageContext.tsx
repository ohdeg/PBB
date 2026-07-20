import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, type TranslateFn } from './translate';

interface ScoreI18nValue {
  t: TranslateFn;
}

const ScoreI18nContext = createContext<ScoreI18nValue | null>(null);

export function ScoreI18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ t: createTranslator() }), []);
  return <ScoreI18nContext.Provider value={value}>{children}</ScoreI18nContext.Provider>;
}

export function useTranslation(): TranslateFn {
  const context = useContext(ScoreI18nContext);
  if (!context) {
    // Allow calling outside provider (pages wrap with provider; components usually nested)
    return createTranslator();
  }
  return context.t;
}
