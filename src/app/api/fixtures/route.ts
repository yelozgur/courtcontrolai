import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    const matches = await prisma.match.findMany({
      where: tournamentId ? { tournamentId } : undefined,
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
      include: {
        court: {
          select: { id: true, name: true, venue: { select: { id: true, name: true } } },
        },
        category: {
          select: { id: true, name: true },
        },
      },
      take: 200,
    });

    const playerIds = [...new Set(matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id): id is string => id !== null))];
    const players = playerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const playerMap = new Map(players.map((p) => [p.id, p.name || p.email || 'Player']));

    const enrichedMatches = matches.map((m) => ({
      ...m,
      player1Name: m.player1Id ? playerMap.get(m.player1Id) || 'Player 1' : null,
      player2Name: m.player2Id ? playerMap.get(m.player2Id) || 'Player 2' : null,
      location: m.court?.venue?.name || null,
    }));

    return NextResponse.json(enrichedMatches, { status: 200 });
  } catch (error) {
    console.error('GET /api/fixtures error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
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
    const { tournamentId } = body;

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Missing required field: tournamentId' },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: true,
        matches: true,
        bracket: true,
        club: { select: { ownerId: true, adminIds: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const userId = session.user.id;
    if (tournament.club.ownerId !== userId && !tournament.club.adminIds.includes(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const teams = tournament.teams;
    if (teams.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams to generate fixtures' },
        { status: 400 }
      );
    }

    const schedulerUrl = process.env.SCHEDULER_URL;
    if (!schedulerUrl) {
      return NextResponse.json(
        {
          error: 'Scheduler service not configured',
          message: 'SCHEDULER_URL environment variable is not set',
        },
        { status: 503 }
      );
    }

    try {
      const schedulerResponse = await fetch(`${schedulerUrl}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          teamCount: teams.length,
          existingMatches: tournament.matches.length,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!schedulerResponse.ok) {
        const errorText = await schedulerResponse.text();
        console.error('Scheduler error:', errorText);
        return NextResponse.json(
          {
            error: 'Scheduler service returned an error',
          },
          { status: 502 }
        );
      }

      const schedulerData = await schedulerResponse.json();

      if (tournament.bracket) {
        await prisma.bracket.update({
          where: { id: tournament.bracket.id },
          data: {
            data: schedulerData.bracket || schedulerData,
            version: { increment: 1 },
          },
        });
      } else {
        await prisma.bracket.create({
          data: {
            tournamentId,
            data: schedulerData.bracket || schedulerData,
          },
        });
      }

      if (schedulerData.matches && Array.isArray(schedulerData.matches)) {
        await prisma.match.deleteMany({
          where: { tournamentId },
        });

        if (schedulerData.matches.length > 0) {
          await prisma.match.createMany({
            data: schedulerData.matches.map((match: any, index: number) => ({
              tournamentId,
              round: match.round || 1,
              position: match.position || index,
              player1Id: match.player1Id || null,
              player2Id: match.player2Id || null,
              scheduledAt: match.scheduledAt ? new Date(match.scheduledAt) : null,
            })),
          });
        }
      }

      return NextResponse.json(
        {
          success: true,
          tournamentId,
          matchesGenerated: schedulerData.matches?.length || 0,
          bracket: schedulerData.bracket || schedulerData,
        },
        { status: 200 }
      );
    } catch (schedulerError) {
      console.error('Scheduler call failed:', schedulerError);
      return NextResponse.json(
        {
          error: 'Failed to call scheduler service',
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('POST /api/fixtures error:', error);
    return NextResponse.json(
      { error: 'Failed to generate fixtures' },
      { status: 500 }
    );
  }
}
