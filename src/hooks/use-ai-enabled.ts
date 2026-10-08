'use client';

import { useEffect, useState } from 'react';

/**
 * useAiEnabled — client-side mirror of the server-side `isAiEnabled()` check.
 *
 * The marketing copy "Genkit AI", "AI Scheduling", etc. must not be rendered
 * when the AI backend is disabled (production: GOOGLE_GENAI_API_KEY missing).
 * Otherwise we are selling a feature that the platform cannot deliver.
 *
 * Source of truth is /api/ai/status, which reads the same env as the server
 * helper. Client defaults to `false` so the conservative (no-claim) state is
 * shown on first paint and on any fetch failure.
 */
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
