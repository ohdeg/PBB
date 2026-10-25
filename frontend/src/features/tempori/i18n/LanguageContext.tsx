import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, type TranslateFn } from './translate';

interface TemporiI18nValue {
  t: TranslateFn;
}

const TemporiI18nContext = createContext<TemporiI18nValue | null>(null);

export function TemporiI18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ t: createTranslator() }), []);
  return <TemporiI18nContext.Provider value={value}>{children}</TemporiI18nContext.Provider>;
}

export function useTranslation(): TranslateFn {
  const context = useContext(TemporiI18nContext);
  if (!context) {
    // Allow calling outside provider (pages wrap with provider; components usually nested)
    return createTranslator();
  }
  return context.t;
}
