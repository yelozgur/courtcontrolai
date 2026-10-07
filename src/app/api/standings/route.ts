import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: tournamentId' },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: true,
        matches: {
          where: { status: 'COMPLETED' },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const playerToTeam = new Map<string, string>();
    for (const t of tournament.teams) {
      for (const pid of t.playerIds) {
        playerToTeam.set(pid, t.id);
      }
    }

    const standings = tournament.teams.map(
      (team: { id: string; name: string; clubId: string; playerIds: string[] }) => {
        const teamMatches = tournament.matches.filter((match) => {
          const t1 = match.player1Id ? playerToTeam.get(match.player1Id) : undefined;
          const t2 = match.player2Id ? playerToTeam.get(match.player2Id) : undefined;
          return t1 === team.id || t2 === team.id;
        });

        let wins = 0;
        let losses = 0;
        let draws = 0;
        let pointsFor = 0;
        let pointsAgainst = 0;

        for (const match of teamMatches) {
          const team1Id = match.player1Id ? playerToTeam.get(match.player1Id) : undefined;
          const isPlayer1 = team1Id === team.id;
          const teamScore = isPlayer1 ? match.score1 : match.score2;
          const opponentScore = isPlayer1 ? match.score2 : match.score1;

          pointsFor += teamScore;
          pointsAgainst += opponentScore;

          if (teamScore > opponentScore) {
            wins++;
          } else if (teamScore < opponentScore) {
            losses++;
          } else {
            draws++;
          }
        }

        const points = wins * 2 + draws * 1;
        const matchesPlayed = wins + losses + draws;

        return {
          teamId: team.id,
          teamName: team.name,
          clubId: team.clubId,
          matchesPlayed,
          wins,
          losses,
          draws,
          pointsFor,
          pointsAgainst,
          pointsDifference: pointsFor - pointsAgainst,
          points,
        };
      }
    );

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointsDifference !== a.pointsDifference)
        return b.pointsDifference - a.pointsDifference;
      return b.pointsFor - a.pointsFor;
    });

    const standingsWithRank = standings.map((team, index) => ({
      ...team,
      rank: index + 1,
    }));

    return NextResponse.json(
      {
        tournamentId,
        tournamentName: tournament.name,
        standings: standingsWithRank,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/standings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch standings', details: (error as Error).message },
      { status: 500 }
    );
  }
}
