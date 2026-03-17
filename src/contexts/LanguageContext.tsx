import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { Language, translations, Translations, getTranslationStringAtPath, interpolateTranslation } from '@/lib/i18n';
import { getCollection, getDocument } from '@/integrations/firebase/firestore';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations & { get: (path: string, params?: Record<string, string | number>) => string };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type I18nSettingsDoc = { id: string; enabled?: boolean; version?: number };
type I18nOverrideDoc = { id: string; pt?: string; en?: string; es?: string; updatedAt?: unknown };

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function trackMissingKey(lang: Language, path: string) {
  const raw = safeLocalStorageGet('cpc-i18n-missing');
  const parsed = safeJsonParse<Record<string, Record<string, number>>>(raw) ?? {};
  const bucket = parsed[lang] ?? {};
  bucket[path] = (bucket[path] ?? 0) + 1;
  parsed[lang] = bucket;
  safeLocalStorageSet('cpc-i18n-missing', JSON.stringify(parsed));
}

function getFromOverrides(overrides: Record<string, string> | null, path: string): string | undefined {
  if (!overrides) return undefined;
  const v = overrides[path];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function createTranslationProxy(args: {
  language: Language;
  overrides: Record<string, string> | null;
  ptOverrides: Record<string, string> | null;
  get: (path: string, params?: Record<string, string | number>) => string;
}) {
  const { language, overrides, ptOverrides, get } = args;

  function makeProxy(node: unknown, prefix: string): unknown {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    return new Proxy(node as Record<string, unknown>, {
      get(target, prop) {
        if (prop === 'get') return get;
        if (typeof prop !== 'string') return (target as Record<string, unknown>)[prop as unknown as string];

        const nextPath = prefix ? `${prefix}.${prop}` : prop;
        const overrideValue = getFromOverrides(overrides, nextPath) ?? getFromOverrides(ptOverrides, nextPath);

        if (overrideValue !== undefined) return overrideValue;

        const baseValue = (target as Record<string, unknown>)[prop];
        if (typeof baseValue === 'string') return baseValue;
        if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) return makeProxy(baseValue, nextPath);
        if (Array.isArray(baseValue)) return baseValue;

        const fallback = getTranslationStringAtPath('pt', nextPath);
        if (fallback !== undefined) {
          trackMissingKey(language, nextPath);
          return fallback;
        }
        trackMissingKey(language, nextPath);
        return nextPath;
      },
    });
  }

  return makeProxy(translations[language], '') as Translations & { get: typeof get };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = safeLocalStorageGet('cpc-language');
    return (stored as Language) || 'pt';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    safeLocalStorageSet('cpc-language', lang);
  }, []);

  const [settings, setSettings] = useState<{ enabled: boolean; version: number }>(() => ({
    enabled: true,
    version: 0,
  }));
  const [overrides, setOverrides] = useState<Record<string, string> | null>(null);
  const [ptOverrides, setPtOverrides] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const cached = safeJsonParse<{ enabled: boolean; version: number; cachedAt: number }>(
        safeLocalStorageGet('cpc-i18n-settings')
      );
      const now = Date.now();
      if (cached && now - cached.cachedAt < 10 * 60 * 1000) {
        if (!cancelled) setSettings({ enabled: cached.enabled, version: cached.version });
        return { enabled: cached.enabled, version: cached.version };
      }

      try {
        const doc = await getDocument<I18nSettingsDoc>('i18n', 'settings');
        const enabled = doc?.enabled !== false;
        const version = typeof doc?.version === 'number' ? doc.version : 0;
        safeLocalStorageSet('cpc-i18n-settings', JSON.stringify({ enabled, version, cachedAt: now }));
        if (!cancelled) setSettings({ enabled, version });
        return { enabled, version };
      } catch {
        const fallback = { enabled: true, version: 0 };
        if (!cancelled) setSettings(fallback);
        return fallback;
      }
    }

    async function loadOverrides(lang: Language, version: number) {
      const cacheKey = `cpc-i18n-overrides-${lang}-v${version}`;
      const cached = safeJsonParse<{ data: Record<string, string> }>(safeLocalStorageGet(cacheKey));
      if (cached?.data) return cached.data;

      const docs = await getCollection<I18nOverrideDoc>('i18n_overrides');
      const mapped: Record<string, string> = {};
      for (const d of docs) {
        const value = d[lang];
        if (typeof value === 'string' && value.trim()) mapped[d.id] = value;
      }
      safeLocalStorageSet(cacheKey, JSON.stringify({ data: mapped }));
      return mapped;
    }

    (async () => {
      const nextSettings = await loadSettings();
      if (cancelled) return;
      if (!nextSettings.enabled) {
        setOverrides(null);
        setPtOverrides(null);
        return;
      }

      try {
        const [pt, cur] = await Promise.all([
          loadOverrides('pt', nextSettings.version),
          loadOverrides(language, nextSettings.version),
        ]);
        if (!cancelled) {
          setPtOverrides(pt);
          setOverrides(cur);
        }
      } catch {
        if (!cancelled) {
          setPtOverrides(null);
          setOverrides(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [language]);

  const get = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const overrideValue = getFromOverrides(overrides, path) ?? getFromOverrides(ptOverrides, path);
      if (overrideValue !== undefined) return interpolateTranslation(overrideValue, params);

      const current = getTranslationStringAtPath(language, path);
      if (current !== undefined) return interpolateTranslation(current, params);

      const fallback = getTranslationStringAtPath('pt', path);
      if (fallback !== undefined) {
        trackMissingKey(language, path);
        return interpolateTranslation(fallback, params);
      }

      trackMissingKey(language, path);
      return path;
    },
    [language, overrides, ptOverrides]
  );

  const t = useMemo(
    () =>
      createTranslationProxy({
        language,
        overrides,
        ptOverrides,
        get,
      }),
    [language, overrides, ptOverrides, get]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t } as LanguageContextType}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
