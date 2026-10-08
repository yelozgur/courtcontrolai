import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Every exported handler under src/app/api must check the session.
 *
 * This gap is not hypothetical: two routes had a guarded POST and an unguarded
 * GET, so the data stayed readable by anonymous callers even after the security
 * fix was written and reviewed. A reviewer reading "auth() is imported" believes
 * the route is protected; only calling it does that.
 *
 * Routes that are deliberately public must be listed in PUBLIC_ROUTES with a
 * reason, so the exception is visible instead of implicit.
 */

const API_DIR = join(process.cwd(), 'src/app/api');

// Routes that serve content to signed-out visitors on purpose, with the reason.
// An exception must be written down here, otherwise it is invisible.
const PUBLIC_ROUTES = new Set<string>([
  // Public home page calls this through useAiEnabled() to decide whether to show
  // AI affordances. Returns only {enabled}; config internals stay server-side.
  'src/app/api/ai/status/route.ts#GET',
  // Development-only helper; hard-disabled in production by NODE_ENV.
  'src/app/api/auth/test-mode/route.ts#GET',
  // Firestore REST proxy for local development; returns 404 "disabled in
  // production" outside development.
  'src/app/api/firestore/[...path]/route.ts#GET',
]);

function collectRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectRouteFiles(full, acc);
    else if (entry === 'route.ts') acc.push(full);
  }
  return acc;
}

type Handler = { file: string; name: string; body: string };

function handlers(): Handler[] {
  const out: Handler[] = [];
  for (const file of collectRouteFiles(API_DIR)) {
    const src = readFileSync(file, 'utf8');
    const parts = src.split(/export\s+async\s+function\s+/).slice(1);
    for (const part of parts) {
      const name = part.slice(0, part.indexOf('(')).trim();
      out.push({ file: relative(process.cwd(), file), name, body: part });
    }
  }
  return out;
}

describe('API route auth coverage', () => {
  it('finds the route handlers', () => {
    expect(handlers().length).toBeGreaterThan(5);
  });

  it('no handler is left without a session check', () => {
    const unguarded = handlers()
      .filter(h => !h.body.includes('auth()'))
      .filter(h => !PUBLIC_ROUTES.has(`${h.file}#${h.name}`))
      .map(h => `${h.file} → ${h.name}`);

    expect(
      unguarded,
      'these handlers never call auth(); either guard them or add them to PUBLIC_ROUTES with a reason',
    ).toEqual([]);
  });

  it('imports auth only where it is actually used', () => {
    // An unused import is the exact shape that hid the bug: the file looked
    // protected to a reader while GET stayed open.
    const suspicious = handlers()
      .filter(h => h.file.endsWith('route.ts'))
      .filter(h => h.body.includes("from '@/lib/auth'"))
      .map(h => h.file);
    expect(Array.from(new Set(suspicious))).toEqual([]);
  });
});