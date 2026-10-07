import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    const matches = await prisma.match.findMany({
      where: {
        ...(tournamentId ? { tournamentId } : {}),
        status: { in: ['COMPLETED', 'WALKOVER', 'DISQUALIFIED'] },
      },
      orderBy: { playedAt: 'desc' },
    });

    return NextResponse.json(matches, { status: 200 });
  } catch (error) {
    console.error('GET /api/results error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
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
    const { matchId, score1, score2, status } = body;

    if (!matchId || score1 === undefined || score2 === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: matchId, score1, score2' },
        { status: 400 }
      );
    }

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      return NextResponse.json(
        { error: 'score1 and score2 must be numbers' },
        { status: 400 }
      );
    }

    if (score1 < 0 || score2 < 0) {
      return NextResponse.json(
        { error: 'Scores must be non-negative' },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: {
          include: { club: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const isClubAdmin =
      match.tournament.club.ownerId === session.user.firebaseUid ||
      match.tournament.club.ownerId === session.user.id ||
      match.tournament.club.adminIds.includes(session.user.firebaseUid || '') ||
      match.tournament.club.adminIds.includes(session.user.id || '');

    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: not a club admin' },
        { status: 403 }
      );
    }

    const matchStatus = status || 'COMPLETED';
    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'WALKOVER', 'DISQUALIFIED'];
    if (!validStatuses.includes(matchStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        status: matchStatus,
        playedAt: matchStatus === 'COMPLETED' ? new Date() : null,
      },
    });

    return NextResponse.json(updatedMatch, { status: 200 });
  } catch (error) {
    console.error('POST /api/results error:', error);
    return NextResponse.json(
      { error: 'Failed to update match result' },
      { status: 500 }
    );
  }
}
