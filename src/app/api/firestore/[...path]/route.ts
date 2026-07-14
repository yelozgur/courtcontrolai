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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathParts } = await params;
  const path = pathParts.join('/');
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '500';

  // URL: parantez karakterlerini encode et (Node.js fetch parantezleri
  // escape etmiyor, Firestore emulator literal parantez bekliyor)
  const encodedUrl = `${REST_URL}/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent('(default)')}/documents/${path.split('/').map(encodeURIComponent).join('/')}?pageSize=${limit}`;

  try {
    const res = await fetch(encodedUrl, { cache: 'no-store' });
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Firestore REST failed: ${res.status}`, details: errorText },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Proxy error', message: e.message },
      { status: 500 }
    );
  }
}
