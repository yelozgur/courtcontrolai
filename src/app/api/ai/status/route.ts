import { NextResponse } from 'next/server';
import { isAiEnabled } from '@/ai/genkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = isAiEnabled();

  if (!enabled) {
    return NextResponse.json(
      {
        error: 'ai_not_configured',
        message: 'AI features are disabled. GOOGLE_GENAI_API_KEY is not set.',
        reason: 'GOOGLE_GENAI_API_KEY missing or placeholder',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { enabled: true, provider: 'google-genai' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
