/**
 * /api/scheduler/solve — OR-Tools CP-SAT solver bridge (Prisma + NextAuth)
 *
 * Reads a tournament's matches + teams from Neon (via Prisma), authenticates
 * the caller against the tournament's club, calls the standalone scheduler
 * service (default: http://127.0.0.1:8500/schedule, override with
 * SCHEDULER_URL env), and returns optimal court+time assignments.
 *
 * Stage 2 (SEL-93): accepts natural-language preferences, translates them
 * into a structured constraint object via the model, and passes them to the
 * solver. Falls back to no preferences if the model is unavailable.
 *
 * POST /api/scheduler/solve
 * body: { tournamentId: string, marginMinutes?: number, preferencesText?: string, applyAssignments?: boolean }
 * returns: { tournamentId, assignments: [...], makespan_minutes, status, solve_time_seconds, source: "scheduler" | "fallback", preferences?: object, preferencesSource?: "model" | "fallback" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { translatePreferences, type TranslationContext } from '@/lib/scheduler/constraint-translator';
import { emptyPreferences, type SchedulePreferences } from '@/lib/scheduler/constraint-schema';
import { verifySchedule, type VerifierInput, type VerifierMatch } from '@/lib/schedule-verifier';

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

function explainInfeasibility(
  data: SchedulerResponse & { conflicting_locks?: string[]; skipped_matches?: string[] },
  payload: Record<string, unknown>,
  matches: Array<{ id: string; player1Id: string | null; player2Id: string | null }>
): string {
  const parts: string[] = [];

  if (data.conflicting_locks && data.conflicting_locks.length > 0) {
    parts.push(`Referee lock conflict: ${data.conflicting_locks.length} match(es) are locked to courts that no longer exist (${data.conflicting_locks.join(', ')}). The referee must re-assign these locks.`);
  }

  const pMatches = payload.matches as Array<{ match_id: string; player_ids: string[]; duration_minutes: number }>;
  const pCourts = payload.courts as Array<{ court_id: string }>;
  const totalMatchMinutes = pMatches.reduce((s, m) => s + m.duration_minutes, 0);
  const totalCourts = pCourts.length;

  if (totalCourts === 0) {
    parts.push('No courts available. Add at least one court to the venue before scheduling.');
  }

  const playerMatchCount: Record<string, number> = {};
  for (const m of pMatches) {
    for (const pid of m.player_ids) {
      playerMatchCount[pid] = (playerMatchCount[pid] || 0) + 1;
    }
  }
  const overloadedPlayers = Object.entries(playerMatchCount).filter(([, count]) => count > totalCourts * 2);
  if (overloadedPlayers.length > 0) {
    parts.push(`Player overload: ${overloadedPlayers.map(([pid, count]) => `${pid} has ${count} matches but only ${totalCourts} court(s) available`).join('; ')}. Consider adding courts or reducing matches.`);
  }

  const estimatedSequential = totalMatchMinutes + (pMatches.length - 1) * (payload.margin_minutes as number);
  const availableCourtMinutes = totalCourts * 14 * 60;
  if (estimatedSequential > availableCourtMinutes && totalCourts > 0) {
    parts.push(`Capacity: ${pMatches.length} matches need ~${Math.round(estimatedSequential / 60)}h of court time across ${totalCourts} court(s), but only ~${Math.round(availableCourtMinutes / 60)}h is available in a 14-hour day. Add courts, reduce matches, or shorten match duration.`);
  }

  if (parts.length === 0) {
    parts.push(`The solver could not find a valid schedule (${data.status}). This usually means the constraints are too tight for the available courts and time. Try: (1) adding more courts, (2) increasing the time window, (3) reducing the rest margin, or (4) removing some matches.`);
  }

  return parts.join(' ');
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON with a tournamentId.' },
      { status: 400 }
    );
  }

  const {
    tournamentId,
    marginMinutes,
    preferencesText,
    applyAssignments = false,
  } = (body ?? {}) as {
    tournamentId?: string;
    marginMinutes?: number;
    preferencesText?: string;
    applyAssignments?: boolean;
  };

  if (!tournamentId || typeof tournamentId !== 'string') {
    return NextResponse.json(
      { error: 'tournamentId_required', message: 'tournamentId is required.' },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorised('Oturum açmanız gerekiyor.');
  }
  const userId = session.user.id;

  let tournament: {
    id: string;
    clubId: string;
    startsAt: Date;
    settings: unknown;
    club: {
      ownerId: string;
      adminIds: string[];
      venues: Array<{
        id: string;
        name: string;
        openHours: unknown;
        courts: Array<{ id: string; name: string; order: number }>;
      }>;
    };
    categories: Array<{ id: string; name: string }>;
  } | null;
  let matches: Array<{
    id: string;
    round: number;
    position: number;
    player1Id: string | null;
    player2Id: string | null;
    categoryId: string | null;
    category: { matchMinutes: number } | null;
  }> = [];

  try {
    tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        club: {
          select: {
            ownerId: true,
            adminIds: true,
            venues: {
              orderBy: { name: 'asc' },
              select: {
                id: true,
                name: true,
                openHours: true,
                courts: {
                  orderBy: { order: 'asc' },
                  select: { id: true, name: true, order: true },
                },
              },
            },
          },
        },
        categories: {
          select: { id: true, name: true },
        },
      },
    });

    if (!tournament) {
      return notFound(`Tournament ${tournamentId} not found.`);
    }

    matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
      select: {
        id: true, round: true, position: true,
        player1Id: true, player2Id: true,
        categoryId: true,
        category: { select: { matchMinutes: true } },
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[scheduler] Prisma read failed:', detail);
    return serviceUnavailable('database_unavailable', 'Turnuva verileri okunamadı. Lütfen tekrar deneyin.');
  }

  const isOwner = tournament.club.ownerId === userId;
  const isAdmin = tournament.club.adminIds.includes(userId);
  if (!isOwner && !isAdmin) {
    return forbidden('Bu turnuvayı çözümleme yetkiniz yok.');
  }

  const settings = (tournament.settings ?? {}) as { courts?: Array<{ court_id: string; name?: string }> };
  const dbCourts = tournament.club.venues.flatMap((v) =>
    v.courts.map((c) => ({
      court_id: c.id,
      name: c.name,
      venue_id: v.id,
    }))
  );
  const settingsCourts =
    Array.isArray(settings.courts) && settings.courts.length > 0
      ? settings.courts.map((c) => ({ court_id: c.court_id, name: c.name ?? c.court_id, venue_id: c.court_id }))
      : [];
  const courts = dbCourts.length > 0 ? dbCourts : settingsCourts.length > 0 ? settingsCourts : [
    { court_id: 'c1', name: 'Court 1', venue_id: 'c1' },
    { court_id: 'c2', name: 'Court 2', venue_id: 'c2' },
  ];

  const dbVenues = tournament.club.venues
    .filter((v) => v.courts.length > 0)
    .map((v) => ({
      venue_id: v.id,
      courts: v.courts.map((c) => c.id),
      open_hours: (v.openHours as Record<string, string[][]> | null) ?? undefined,
    }));
  const venues = dbVenues.length > 0
    ? dbVenues
    : courts.map((c) => ({ venue_id: c.venue_id ?? c.court_id, courts: [c.court_id] }));

  let prefs: SchedulePreferences = { ...emptyPreferences };
  let prefsSource: 'model' | 'fallback' = 'fallback';
  let prefsRejectionReason: string | undefined;

  if (preferencesText?.trim()) {
    const ctx: TranslationContext = {
      courtIds: courts.map((c) => c.court_id),
      courtNames: Object.fromEntries(courts.map((c) => [c.court_id, c.name])),
      categoryIds: tournament.categories.map((c) => c.id),
      categoryNames: Object.fromEntries(tournament.categories.map((c) => [c.id, c.name])),
    };
    const result = await translatePreferences(preferencesText, ctx);
    prefs = result.preferences;
    prefsSource = result.source;
    prefsRejectionReason = result.rejectionReason;
  } else if (marginMinutes !== undefined) {
    prefs = { ...emptyPreferences, minRestMinutes: marginMinutes };
  }

  const effectiveMargin = prefs.minRestMinutes;

  const payload = {
    tournament_id: tournamentId,
    start_time_iso: tournament.startsAt.toISOString(),
    matches: matches.map((m) => {
      const playerIds: string[] = [];
      if (m.player1Id) playerIds.push(m.player1Id);
      if (m.player2Id) playerIds.push(m.player2Id);
      const baseDuration = m.category?.matchMinutes ?? 60;
      const overrideDuration = m.categoryId ? prefs.categoryDurations[m.categoryId] : undefined;
      return {
        match_id: m.id,
        duration_minutes: overrideDuration ?? baseDuration,
        player_ids: playerIds,
      };
    }),
    courts,
    venues,
    margin_minutes: effectiveMargin,
    court_priority: prefs.courtPriority,
    day_compaction: prefs.dayCompaction,
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

  try {
    const res = await fetch(`${SCHEDULER_URL}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SCHEDULER_TIMEOUT_MS),
    });

    if (!res.ok) {
      await res.text();
      return NextResponse.json(
        { error: 'scheduler_failed' },
        { status: 502 }
      );
    }

    const data = (await res.json()) as SchedulerResponse;

    if (applyAssignments && data.assignments.length > 0) {
      try {
        await prisma.$transaction([
          ...data.assignments.map((a) =>
            prisma.match.update({
              where: { id: a.match_id },
              data: {
                scheduledAt: new Date(a.start_time_iso),
                courtId: a.court_id,
              },
            })
          ),
          prisma.tournament.update({
            where: { id: tournamentId },
            data: { preferences: prefs as any },
          }),
        ]);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error('[scheduler] apply assignments failed:', detail);
        return serviceUnavailable('assignment_write_failed', 'Çözüm bulundu ancak maçlara uygulanamadı.');
      }
    }

    return NextResponse.json({
      ...data,
      source: 'scheduler',
      preferences: prefs,
      preferencesSource: prefsSource,
      ...(prefsRejectionReason ? { preferencesRejectionReason: prefsRejectionReason } : {}),
    });
  } catch (e) {
    console.error('[scheduler/solve] scheduler unreachable:', (e as Error).message);
    return NextResponse.json(
      {
        error: 'scheduler_unreachable',
      },
      { status: 503 }
    );
  }
}
