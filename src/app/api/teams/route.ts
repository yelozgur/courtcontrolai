import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    const teams = await prisma.team.findMany({
      where: tournamentId ? { tournamentId } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        club: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json(teams, { status: 200 });
  } catch (error) {
    console.error('GET /api/teams error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: (error as Error).message },
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
    const { name, tournamentId, clubId, playerIds } = body;

    if (!name || !tournamentId || !clubId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, tournamentId, clubId' },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { club: true },
    });
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.clubId !== clubId) {
      return NextResponse.json(
        { error: 'Club does not match tournament club' },
        { status: 400 }
      );
    }

    const isClubAdmin =
      tournament.club.ownerId === session.user.firebaseUid ||
      tournament.club.ownerId === session.user.id ||
      tournament.club.adminIds.includes(session.user.firebaseUid || '') ||
      tournament.club.adminIds.includes(session.user.id || '');

    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: not a club admin' },
        { status: 403 }
      );
    }

    const team = await prisma.team.create({
      data: {
        name,
        tournamentId,
        clubId,
        playerIds: playerIds || [],
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('POST /api/teams error:', error);
    return NextResponse.json(
      { error: 'Failed to create team', details: (error as Error).message },
      { status: 500 }
    );
  }
}
