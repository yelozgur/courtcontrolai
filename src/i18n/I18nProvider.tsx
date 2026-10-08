'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_LOCALE, type Locale, t as translate } from './translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'cca_locale';

/**
 * CourtControl AI: i18n Provider.
 *
 * Locale state'ini localStorage'da persist eder.
 *
 * Default İngilizcedir. Tarayıcı dili algılanmaz: bir Türkçe tarayıcıda
 * açılan ürün yine İngilizce görünür, çünkü varsayılan dil kullanıcının
 * cihazına değil ürünün hedef kitlesine göre belirlenir. Kullanıcı Türkçe
 * seçerse bu tercih localStorage'da saklanır ve bir daha sorulmaz.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage (default EN)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && (stored === 'tr' || stored === 'en')) {
        setLocaleState(stored);
      }
      // No stored choice: keep DEFAULT_LOCALE (English).
      // An explicit previous choice is always respected.
    } catch {
      // localStorage unavailable, keep default
    }
    setHydrated(true);
  }, []);

  // Persist on change
  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
  };

  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback if not wrapped (shouldn't happen in normal use)
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        translate(DEFAULT_LOCALE, key, params),
    };
  }
  return ctx;
}
