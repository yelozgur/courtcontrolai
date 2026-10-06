'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // The auth context is not available YET — it may still be initialising,
      // or Firebase may have failed to start. This is not the same as being
      // signed out, and callers must not treat it as such: the dashboard used
      // to read `!loading && !user` as "signed out" and redirect, which turned
      // a startup window (and any init failure) into a session expiry. Keep
      // loading true and expose `authUnavailable` so callers can show a real
      // backend error instead.
      setUser(null);
      return;
    }

    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading, authUnavailable: auth === null };
}
