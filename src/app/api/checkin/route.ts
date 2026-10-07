import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkin — Record a QR/manual attendance scan for a registration.
 *
 * Body: { registrationId: string, method?: string, scannedBy?: string }
 *
 * Duplicate scan policy: returns 409 Conflict if a check-in already exists
 * for the same registrationId. This is a deliberate choice — the caller can
 * decide whether to treat it as an error or ignore it. Multiple scans per
 * registration are legitimate (re-entry), but the endpoint enforces one
 * explicit check-in record per registration to keep the attendance ledger clean.
 *
 * Two-layer attendance model:
 * - Layer 1 (this endpoint): QR scan = evidence of physical presence.
 * - Layer 2 (referee decision): no_show / no_court_show = match outcome.
 * This endpoint does NOT set Registration.skipped or skipReason.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const registrationId =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).registrationId
        : undefined;

    if (typeof registrationId !== 'string' || registrationId.trim() === '') {
      return NextResponse.json(
        { error: 'registrationId is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const method =
      typeof (body as Record<string, unknown>).method === 'string'
        ? ((body as Record<string, unknown>).method as string)
        : 'qr';

    const scannedBy =
      typeof (body as Record<string, unknown>).scannedBy === 'string'
        ? ((body as Record<string, unknown>).scannedBy as string)
        : null;

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const existing = await prisma.checkIn.findFirst({
      where: { registrationId },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: 'Check-in already exists for this registration',
          existingCheckIn: existing,
        },
        { status: 409 }
      );
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        registrationId,
        method,
        scannedBy,
      },
    });

    return NextResponse.json({ checkIn }, { status: 201 });
  } catch (error) {
    console.error('POST /api/checkin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
