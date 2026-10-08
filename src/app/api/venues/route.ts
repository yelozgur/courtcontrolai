import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getClubForUser(userId: string) {
  return prisma.club.findFirst({
    where: {
      OR: [
        { ownerId: userId },
        { adminIds: { has: userId } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      adminIds: true,
    },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const club = await getClubForUser(userId);
  if (!club) {
    return NextResponse.json({ error: 'No club found for user' }, { status: 404 });
  }

  try {
    const venues = await prisma.venue.findMany({
      where: { clubId: club.id },
      orderBy: { name: 'asc' },
      include: {
        courts: { orderBy: { order: 'asc' } },
      },
    });
    return NextResponse.json(venues, { status: 200 });
  } catch (error) {
    console.error('GET /api/venues error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const club = await getClubForUser(userId);
  if (!club) {
    return NextResponse.json({ error: 'No club found for user' }, { status: 404 });
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

  const { name } = (body ?? {}) as { name?: string };
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  try {
    const venue = await prisma.venue.create({
      data: {
        clubId: club.id,
        name: name.trim(),
        courts: { create: [] },
      },
      include: { courts: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    console.error('POST /api/venues error:', error);
    return NextResponse.json(
      { error: 'Failed to create venue' },
      { status: 500 }
    );
  }
}
