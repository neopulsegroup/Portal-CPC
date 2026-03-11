import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Language, translations, Translations } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations & { get: (path: string) => string };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('cpc-language');
    return (stored as Language) || 'pt';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cpc-language', lang);
  }, []);

  const get = useCallback((path: string): string => {
    const keys = path.split('.');
    let current: unknown = translations[language];

    // Debug log for specific failing keys
    if (path.includes('triage.steps.personal_data') || path.includes('triage.questions.birth_date')) {
      // console.log(`[LanguageContext] Getting path: ${path}, language: ${language}`);
    }

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return path;
      }
    }
    return typeof current === 'string' ? current : path;
  }, [language]);

  const t = {
    ...translations[language],
    get
  };

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
