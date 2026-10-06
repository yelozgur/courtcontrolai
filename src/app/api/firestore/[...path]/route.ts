import { NextRequest, NextResponse } from 'next/server';

/**
 * CourtControl AI: Server-side Firestore REST API proxy.
 *
 * Browser'dan doğrudan emulator REST API'sine erişim CORS / auth sorunları
 * yaratıyor. Bu route, server-side'da Firestore emulator'a istek atar,
 * response'u JSON olarak browser'a döndürür.
 *
 * Kullanım: GET /api/firestore/<collection>
 * Örnek: /api/firestore/tournaments?limit=50
 * Subcollection: /api/firestore/tournaments/abc/registrations?limit=50
 */

// Force-set Firebase emulator env (Next.js bunlari build time'da inline etmiyor)
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-app';
process.env.FIREBASE_EMULATOR_HUB = process.env.FIREBASE_EMULATOR_HUB || 'demo-app';

const REST_URL = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_URL || 'http://127.0.0.1:8080';
const PROJECT_ID = 'demo-app'; // hardcoded for emulator

/**
 * This proxy talks to the Firestore EMULATOR, which does not evaluate
 * firestore.rules. Anyone who could reach it therefore bypassed every rule
 * the production database relies on (`isSignedIn()`, `isAdmin()`), and the
 * route exposed arbitrary collections to any unauthenticated caller.
 *
 * Two guards, both cheap:
 *  1. In production the route is disabled outright. The app is supposed to use
 *     the client SDK there, which enforces firestore.rules for real.
 *  2. Even in dev, only collections that are publicly readable per
 *     firestore.rules may be fetched. Admin/private data is never proxied.
 */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Top-level collections that firestore.rules marks as publicly readable. */
const PUBLIC_COLLECTIONS = new Set(['tournaments', 'clubs', 'sponsors', 'publicconfig']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (IS_PRODUCTION) {
    return NextResponse.json(
      {
        error: 'firestore_proxy_disabled',
        message: 'The Firestore REST proxy is a development-only helper and is disabled in production.',
      },
      { status: 404 }
    );
  }

  const { path: pathParts } = await params;
  const path = pathParts.join('/');
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '500';

  const rootCollection = pathParts[0];
  if (!rootCollection || !PUBLIC_COLLECTIONS.has(rootCollection)) {
    return NextResponse.json(
      {
        error: 'collection_not_allowed',
        message: 'This collection is not available through the development proxy.',
        allowed: [...PUBLIC_COLLECTIONS],
      },
      { status: 403 }
    );
  }

  // URL: parantez karakterlerini encode et (Node.js fetch parantezleri
  // escape etmiyor, Firestore emulator literal parantez bekliyor)
  const encodedUrl = `${REST_URL}/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent('(default)')}/documents/${path.split('/').map(encodeURIComponent).join('/')}?pageSize=${limit}`;

  try {
    const res = await fetch(encodedUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      // Keep the upstream body for server-side diagnosis only. Dropping it
      // entirely (as this route briefly did) removed the only clue available
      // when an upstream call fails; echoing it to the client would reflect
      // internal detail back to the caller.
      // eslint-disable-next-line no-console
      console.error(`[firestore proxy] upstream ${res.status} for /${path}:`, await res.text());
      return NextResponse.json(
        {
          error: 'firestore_upstream_failed',
          message: `Firestore REST returned ${res.status}.`,
        },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    // The upstream (Firestore emulator / production endpoint) is unreachable.
    // That is a dependency failure, not a bug in this route, so it must not
    // surface as an unhandled 500. A timeout is reported as 504, any other
    // connection failure as 502.
    const isTimeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    console.error('[firestore proxy] upstream unreachable:', (e as Error).message);
    return NextResponse.json(
      {
        error: 'firestore_unreachable',
        message: isTimeout
          ? 'Firestore did not respond within the timeout.'
          : 'Firestore is not reachable. The database service may be stopped.',
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
