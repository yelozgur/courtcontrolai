'use client';
import { useEffect, useState, useMemo } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from './index';

/**
 * CourtControl AI: Firestore emulator'da `useCollection` (realtime onSnapshot)
 * yavaş/broken. `where` clause'lar da 0 doc dönüyor. Geçici çözüm:
 * getDocs (one-time fetch) + client-side filter.
 *
 * TODO: emulator + realtime query bug fix'ini bekle.
 */
export function useFilteredCollection<T extends { id: string } = any>(
  collectionName: string,
  filterFn?: (item: T) => boolean,
  options: { limit?: number; deps?: any[]; orderByCreated?: boolean } = {}
) {
  const db = useFirestore();
  const { limit: lim = 500, deps = [] } = options;
  const [raw, setRaw] = useState<(T & { id: string })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Stabilize deps for re-fetch trigger
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const q = query(collection(db, collectionName), limit(lim));
    getDocs(q)
      .then(snap => {
        const items = snap.docs.map(d => ({ ...(d.data() as T), id: d.id }));
        setRaw(items);
        setError(null);
      })
      .catch(e => {
        console.error(`[useFilteredCollection:${collectionName}] error:`, e);
        setError(e);
      })
      .finally(() => setLoading(false));
  }, [db, collectionName, lim, depsKey]);

  const filtered = useMemo(() => {
    if (!raw) return null;
    if (!filterFn) return raw;
    return raw.filter(filterFn);
  }, [raw, filterFn]);

  return { data: filtered, loading, error };
}
