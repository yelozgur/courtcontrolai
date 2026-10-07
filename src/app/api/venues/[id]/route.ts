import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getVenueWithClub(venueId: string) {
  return prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      club: { select: { ownerId: true, adminIds: true } },
      courts: { orderBy: { order: 'asc' } },
    },
  });
}

function canManageClub(club: { ownerId: string; adminIds: string[] }, userId: string) {
  return club.ownerId === userId || club.adminIds.includes(userId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.firebaseUid || session.user.id;

  const { id } = await params;
  const venue = await getVenueWithClub(id);
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
  }
  if (!canManageClub(venue.club, userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { club: _club, ...venueData } = venue;
  return NextResponse.json(venueData, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.firebaseUid || session.user.id;

  const { id } = await params;
  const venue = await getVenueWithClub(id);
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
  }
  if (!canManageClub(venue.club, userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data = (body ?? {}) as {
    name?: string;
    openHours?: unknown;
    courts?: Array<{ id?: string; name: string; order?: number }>;
  };

  try {
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
      }
    }

    if (data.openHours !== undefined && data.openHours !== null) {
      if (typeof data.openHours !== 'object' || Array.isArray(data.openHours)) {
        return NextResponse.json(
          { error: 'openHours must be an object mapping weekday to time ranges, or null' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.openHours !== undefined) updateData.openHours = data.openHours;

    const updated = await prisma.venue.update({
      where: { id },
      data: updateData,
      include: { courts: { orderBy: { order: 'asc' } } },
    });

    if (data.courts && Array.isArray(data.courts)) {
      const existingCourtIds = venue.courts.map((c) => c.id);
      const incomingCourtIds = data.courts.filter((c) => c.id).map((c) => c.id as string);

      const toDelete = existingCourtIds.filter((eid) => !incomingCourtIds.includes(eid));
      if (toDelete.length > 0) {
        await prisma.court.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (let i = 0; i < data.courts.length; i++) {
        const court = data.courts[i];
        if (!court.name || typeof court.name !== 'string' || !court.name.trim()) {
          continue;
        }
        const order = court.order ?? i;
        if (court.id && existingCourtIds.includes(court.id)) {
          await prisma.court.update({
            where: { id: court.id },
            data: { name: court.name.trim(), order },
          });
        } else {
          await prisma.court.create({
            data: { venueId: id, name: court.name.trim(), order },
          });
        }
      }
    }

    const final = await prisma.venue.findUnique({
      where: { id },
      include: { courts: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(final, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/venues/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update venue', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.firebaseUid || session.user.id;

  const { id } = await params;
  const venue = await getVenueWithClub(id);
  if (!venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
  }
  if (!canManageClub(venue.club, userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await prisma.venue.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/venues/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete venue', details: (error as Error).message },
      { status: 500 }
    );
  }
}
