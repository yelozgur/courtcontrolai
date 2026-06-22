'use client';

import { useMemo, useRef } from 'react';

/**
 * A specialized memoization hook for Firebase queries and references.
 * It prevents infinite re-renders by ensuring the reference only changes
 * when its actual dependencies change.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  // Use a ref to track if it's the first render
  const isFirstRender = useRef(true);
  
  // Disable exhaustive-deps here as this is a wrapper hook designed 
  // to work with dynamic dependency arrays for Firebase reference stability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedValue = useMemo(factory, deps);

  if (isFirstRender.current) {
    isFirstRender.current = false;
  }

  return memoizedValue;
}