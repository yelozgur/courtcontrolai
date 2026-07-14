'use client';
import { useEffect, useState, useMemo } from 'react';

/**
 * CourtControl AI: Firestore emulator'da client SDK hem WHERE clause hem de
 * onSnapshot ile broken (0 doc döndürüyor). Çözüm: Next.js API route
 * server-side Firestore REST API'sine bağlanır, browser'a JSON döndürür.
 *
 * Browser'dan doğrudan REST çağrısı CORS sorunları yaratıyor (emulator
 * preflight'ı handle etmiyor). API route bu sorunu bypass eder.
 *
 * TODO: client SDK + emulator bug fix'ini bekle, ya da server-side fetch'e geç.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-app';

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: any;
  timestampValue?: string;
  mapValue?: { fields: Record<string, FirestoreValue> };
  arrayValue?: { values: FirestoreValue[] };
}

function unwrap(val: FirestoreValue): any {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue!);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue!.values || []).map(unwrap);
  if ('mapValue' in val) {
    const m: any = {};
    for (const [k, v] of Object.entries(val.mapValue!.fields || {})) {
      m[k] = unwrap(v);
    }
    return m;
  }
  return null;
}

function parseDoc(d: any): any {
  const out: any = { id: d.name.split('/').pop() };
  for (const [key, val] of Object.entries(d.fields || {})) {
    out[key] = unwrap(val as FirestoreValue);
  }
  return out;
}

async function fetchCollection(collectionPath: string, limitCount = 500): Promise<any[]> {
  const url = `/api/firestore/${collectionPath}?limit=${limitCount}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[useFilteredCollection:${collectionPath}] API failed:`, res.status);
      return [];
    }
    const data = await res.json();
    return (data.documents || []).map(parseDoc);
  } catch (e) {
    console.error(`[useFilteredCollection:${collectionPath}] error:`, e);
    return [];
  }
}

export function useFilteredCollection<T extends { id: string } = any>(
  collectionName: string,
  filterFn?: (item: T) => boolean,
  options: { limit?: number; deps?: any[]; refreshInterval?: number } = {}
) {
  const { limit: lim = 500, deps = [], refreshInterval = 0 } = options;
  const [raw, setRaw] = useState<(T & { id: string })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const items = await fetchCollection(collectionName, lim);
      if (!cancelled) {
        setRaw(items);
        setError(null);
        setLoading(false);
      }
    };
    load();
    let interval: any;
    if (refreshInterval > 0) {
      interval = setInterval(load, refreshInterval);
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [collectionName, lim, depsKey, refreshInterval]);

  const filtered = useMemo(() => {
    if (!raw) return null;
    if (!filterFn) return raw;
    return raw.filter(filterFn);
  }, [raw, filterFn]);

  return { data: filtered, loading, error };
}
