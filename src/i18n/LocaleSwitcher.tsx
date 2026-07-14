'use client';

import { Globe, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from './I18nProvider';
import { SUPPORTED_LOCALES, type Locale } from './translations';
import { Button } from '@/components/ui/button';

/**
 * CourtControl AI: Locale switcher dropdown.
 * Header'a yerleştirilir, kullanıcı TR/EN arasında geçiş yapar.
 * localStorage'da persist edilir.
 */
export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = SUPPORTED_LOCALES.find(l => l.code === locale);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(o => !o)}
        className="text-white/80 hover:text-white gap-2 px-3"
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm font-bold uppercase tracking-widest">
          {current?.code || 'TR'}
        </span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {SUPPORTED_LOCALES.map(l => (
            <button
              key={l.code}
              onClick={() => {
                setLocale(l.code as Locale)
                setOpen(false)
              }}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-white/5 flex items-center justify-between transition-colors ${
                l.code === locale ? 'bg-primary/10 text-primary' : 'text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-lg">{l.flag}</span>
                <span className="font-medium">{l.label}</span>
              </span>
              {l.code === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
