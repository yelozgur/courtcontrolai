import { NextResponse } from 'next/server';
import { isAiEnabled } from '@/ai/genkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public by design: the marketing home page reads it through
 * useAiEnabled() to decide whether to show AI affordances, and signed-out
 * visitors must be able to.
 *
 * That is exactly why the disabled branch says nothing more than "disabled".
 * It previously returned `reason: "GOOGLE_GENAI_API_KEY missing or placeholder"`,
 * which handed anonymous callers a map of which secrets the deployment does and
 * does not have. Status is public; configuration internals are not.
 */
export async function GET() {
  const enabled = isAiEnabled();

  if (!enabled) {
    return NextResponse.json(
      { enabled: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { enabled: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
