import { NextResponse } from 'next/server';
import { isAuthTestEnabled } from '@/lib/auth-test-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ enabled: isAuthTestEnabled() });
}
