'use client';
import { useMemo } from 'react';
import { collection, query, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from './index';

/**
 * CourtControl AI: Kullanıcının kulübünü getirir.
 *
 * NOT (2026-07-12): Firestore client SDK + emulator'da `where("ownerId", "==", user.uid)`
 * 0 doc dönüyor (REST API aynı query ile 1 doc dönüyor). Geçici çözüm:
 * tüm clubs'ı çek, client-side filter yap.
 *
 * TODO: Firestore emulator + WHERE clause bug fix'ini bekle.
 */
export function useUserClub() {
  const db = useFirestore();
  const { user } = useUser();

  const clubsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'clubs'), limit(50));
  }, [db]);

  const { data: allClubs, loading, error } = useCollection(clubsQuery);

  const userClub = useMemo(() => {
    if (!allClubs || !user) return null;
    return allClubs.find(c => c.ownerId === user.uid) || allClubs[0] || null;
  }, [allClubs, user]);

  return { club: userClub, clubId: userClub?.id, loading, error };
}
