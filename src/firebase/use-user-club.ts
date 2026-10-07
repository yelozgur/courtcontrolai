'use client';
import { useMemo } from 'react';
import { collection, query, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from './index';

/**
 * CourtControl AI: Kullanıcının kulübünü getirir.
 *
 * Returns null when no club matches the user's ownerId.
 * No fallback to another club — that would be a multi-tenant scoping bug.
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
    return allClubs.find(c => c.ownerId === user.uid) ?? null;
  }, [allClubs, user]);

  return { club: userClub, clubId: userClub?.id, loading, error };
}
