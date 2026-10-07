import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.AUTH_TEST_ENABLED === 'true';

  return NextResponse.json({ enabled });
}
