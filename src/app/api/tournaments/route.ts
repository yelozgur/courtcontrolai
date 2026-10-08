import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Same gap as /api/clubs: the GET half of this file had no session check
    // even though POST did, so anonymous callers could list every tournament.
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        club: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
    return NextResponse.json(tournaments, { status: 200 });
  } catch (error) {
    console.error('GET /api/tournaments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, clubId, startsAt, endsAt, settings } = body;

    if (!name || !slug || !clubId || !startsAt) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, clubId, startsAt' },
        { status: 400 }
      );
    }

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    const isClubAdmin =
      club.ownerId === session.user.id ||
      club.adminIds.includes(session.user.id);

    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: not a club admin' },
        { status: 403 }
      );
    }

    const existingTournament = await prisma.tournament.findUnique({
      where: { slug },
    });
    if (existingTournament) {
      return NextResponse.json(
        { error: 'Tournament with this slug already exists' },
        { status: 409 }
      );
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        slug,
        clubId,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        settings,
      },
    });

    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    console.error('POST /api/tournaments error:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
