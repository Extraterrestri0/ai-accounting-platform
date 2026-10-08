'use client';

import * as React from 'react';
import { messages, type Lang } from './dictionaries';

const LANG_KEY = 'mgi.lang';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = React.createContext<LangContextValue | null>(null);

function lookup(lang: Lang, key: string): string | undefined {
  const path = key.split('.');
  let node: unknown = messages[lang];
  for (const p of path) {
    if (node && typeof node === 'object' && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>('bg');

  // hydrate from storage + reflect on <html lang>
  React.useEffect(() => {
    const stored = (typeof window !== 'undefined' && window.localStorage.getItem(LANG_KEY)) as Lang | null;
    if (stored === 'bg' || stored === 'en') setLangState(stored);
  }, []);
  React.useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      interpolate(lookup(lang, key) ?? lookup('bg', key) ?? key, vars),
    [lang],
  );

  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

function useCtx(): LangContextValue {
  const ctx = React.useContext(LangContext);
  if (!ctx) throw new Error('useT/useLang must be used within LanguageProvider');
  return ctx;
}

/** Translation function hook: const t = useT(); t('nav.dashboard'). */
export function useT() {
  return useCtx().t;
}

/** Language state hook: const { lang, setLang } = useLang(). */
export function useLang() {
  const { lang, setLang } = useCtx();
  return { lang, setLang };
}

export type { Lang };
