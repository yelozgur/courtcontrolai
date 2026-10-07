/**
 * /api/scheduler/solve — OR-Tools CP-SAT solver bridge (Prisma + NextAuth)
 *
 * Reads a tournament's matches + teams from Neon (via Prisma), authenticates
 * the caller against the tournament's club, calls the standalone scheduler
 * service (default: http://127.0.0.1:8500/schedule, override with
 * SCHEDULER_URL env), and returns optimal court+time assignments.
 *
 * Phase 0/1 migration: this route used to read from Firestore via the
 * client SDK. ADR-001 retires Firestore, so reads now go through Prisma.
 * The Court model is still pending Phase 1; for now the route synthesises
 * two courts if `tournament.settings.courts` is empty.
 *
 * POST /api/scheduler/solve
 * body: { tournamentId: string, marginMinutes?: number }
 * returns: { tournamentId, assignments: [...], makespan_minutes, status, solve_time_seconds, source: "scheduler" | "fallback" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://127.0.0.1:8500';
const SCHEDULER_TIMEOUT_MS = Number(process.env.SCHEDULER_TIMEOUT_MS || '30000');

interface SchedulerAssignment {
  match_id: string;
  court_id: string;
  start_time_iso: string;
  position: number;
}

interface SchedulerResponse {
  tournament_id: string;
  assignments: SchedulerAssignment[];
  makespan_minutes: number;
  status: string;
  solve_time_seconds: number;
}

type AuthorisationError = { error: string; message: string; status: 401 | 403 | 404 | 503 };

function unauthorised(message: string): NextResponse<AuthorisationError> {
  return NextResponse.json({ error: 'unauthorised', message, status: 401 }, { status: 401 });
}

function forbidden(message: string): NextResponse<AuthorisationError> {
  return NextResponse.json({ error: 'forbidden', message, status: 403 }, { status: 403 });
}

function notFound(message: string): NextResponse<AuthorisationError> {
  return NextResponse.json({ error: 'not_found', message, status: 404 }, { status: 404 });
}

function serviceUnavailable(error: string, message: string): NextResponse<AuthorisationError> {
  return NextResponse.json({ error, message, status: 503 }, { status: 503 });
}

export async function POST(req: NextRequest) {
  // ---- Body parsing ---------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON with a tournamentId.' },
      { status: 400 }
    );
  }

  const { tournamentId, marginMinutes = 30 } = (body ?? {}) as {
    tournamentId?: string;
    marginMinutes?: number;
  };

  if (!tournamentId || typeof tournamentId !== 'string') {
    return NextResponse.json(
      { error: 'tournamentId_required', message: 'tournamentId is required.' },
      { status: 400 }
    );
  }

  // ---- Auth ----------------------------------------------------------------
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorised('Oturum açmanız gerekiyor.');
  }
  const userId = session.user.id;

  // ---- Read tournament + matches from Prisma -------------------------------
  let tournament: {
    id: string;
    clubId: string;
    startsAt: Date;
    settings: unknown;
    club: { ownerId: string; adminIds: string[] };
  } | null;
  let matches: Array<{
    id: string;
    round: number;
    position: number;
    player1Id: string | null;
    player2Id: string | null;
  }> = [];

  try {
    tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { club: { select: { ownerId: true, adminIds: true } } },
    });

    if (!tournament) {
      return notFound(`Tournament ${tournamentId} not found.`);
    }

    matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
      select: { id: true, round: true, position: true, player1Id: true, player2Id: true },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[scheduler] Prisma read failed:', detail);
    return serviceUnavailable('database_unavailable', 'Turnuva verileri okunamadı. Lütfen tekrar deneyin.');
  }

  // ---- AuthZ: caller must own, administer, or direct the tournament's club --
  const isOwner = tournament.club.ownerId === userId;
  const isAdmin = tournament.club.adminIds.includes(userId);
  if (!isOwner && !isAdmin) {
    // Phase 1 will add a per-tournament director relation; until then, only
    // club-level owner/admin can solve. This is the safest default.
    return forbidden('Bu turnuvayı çözümleme yetkiniz yok.');
  }

  // ---- Build scheduler payload --------------------------------------------
  const settings = (tournament.settings ?? {}) as { courts?: Array<{ court_id: string; name?: string }> };
  const courts =
    Array.isArray(settings.courts) && settings.courts.length > 0
      ? settings.courts.map((c) => ({ court_id: c.court_id, name: c.name ?? c.court_id }))
      : [{ court_id: 'c1', name: 'Court 1' }, { court_id: 'c2', name: 'Court 2' }];

  const payload = {
    tournament_id: tournamentId,
    start_time_iso: tournament.startsAt.toISOString(),
    matches: matches.map((m) => {
      const playerIds: string[] = [];
      if (m.player1Id) playerIds.push(m.player1Id);
      if (m.player2Id) playerIds.push(m.player2Id);
      return {
        match_id: m.id,
        duration_minutes: 60, // Phase 1: per-round duration; default 60 until then
        player_ids: playerIds,
      };
    }),
    courts,
    margin_minutes: marginMinutes,
  };

  if (payload.matches.length === 0) {
    return NextResponse.json({
      tournament_id: tournamentId,
      assignments: [],
      makespan_minutes: 0,
      status: 'NO_MATCHES',
      message: 'Tournament has no matches. Generate bracket first.',
      source: 'fallback',
    });
  }

  // ---- Call OR-Tools scheduler ---------------------------------------------
  try {
    const res = await fetch(`${SCHEDULER_URL}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SCHEDULER_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { error: 'scheduler_failed', status: res.status, detail: errBody.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as SchedulerResponse;

    return NextResponse.json({
      ...data,
      source: 'scheduler',
      scheduler_url: SCHEDULER_URL,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'scheduler_unreachable',
        scheduler_url: SCHEDULER_URL,
        detail: (e as Error).message,
        hint: 'Make sure OR-Tools scheduler is running: cd services/scheduler && uv run uvicorn app.main:app --port 8500',
      },
      { status: 503 }
    );
  }
}
