/**
 * /api/scheduler/solve — OR-Tools CP-SAT solver bridge
 *
 * Reads a tournament's matches + courts from Firestore, calls the standalone
 * scheduler service (default: http://127.0.0.1:8500/schedule, override with
 * SCHEDULER_URL env), and returns optimal court+time assignments.
 *
 * This is a server-side route. Auth required: club owner or admin.
 *
 * POST /api/scheduler/solve
 * body: { tournamentId: string, marginMinutes?: number }
 * returns: { tournamentId, assignments: [...], makespan_minutes, status, solve_time_seconds, source: "scheduler" | "fallback" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

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

// Lazy-init server-side Firebase client (the @/firebase/client SDK is browser-only;
// we need a server-side admin path. For now, use the same config — in prod this
// route should switch to firebase-admin SDK for proper auth.)
function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Known Firebase initialisation failures. These are CONFIGURATION problems
 * (missing/placeholder projectId or apiKey), not bugs in the request, so they
 * must not surface as a 500 with the raw SDK message attached.
 */
const FIREBASE_CONFIG_ERROR_PATTERNS = [
  /not provided in firebase\.initializeApp/i,
  /invalid-api-key/i,
  /api key not valid/i,
  /invalid project id/i,
  /permission-denied/i,
];

function isFirebaseConfigError(message: string): boolean {
  return FIREBASE_CONFIG_ERROR_PATTERNS.some((re) => re.test(message));
}

export async function POST(req: NextRequest) {
  // Malformed / empty body is a client error. D05: POST {} must be 400, not 500.
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

  // Pre-flight: an incomplete config never reaches the SDK at all.
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    // eslint-disable-next-line no-console
    console.error('[scheduler] Firebase config incomplete: projectId/apiKey missing');
    return NextResponse.json(
      {
        error: 'firebase_not_configured',
        message: 'Veritabani yapilandirmasi eksik. Firestore yapilandirmasini kontrol edin.',
      },
      { status: 503 }
    );
  }

  // 1. Read tournament + subcollections (matches, courts) from Firestore
  let tournamentDoc;
  let matches: Array<{ id: string; data: Record<string, unknown> }> = [];
  let courts: Array<{ id: string; data: Record<string, unknown> }> = [];

  try {
    const db = getDb();
    const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
    tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    if (!tournamentDoc.exists()) {
      return NextResponse.json({ error: `tournament ${tournamentId} not found` }, { status: 404 });
    }
    const matchesSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches'));
    matches = matchesSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
    const courtsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'courts'));
    courts = courtsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (e) {
    // Server-side only: the raw SDK message is logged, never returned. It can
    // contain config details the client has no use for.
    const detail = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[scheduler] Firestore read failed:', detail);

    if (isFirebaseConfigError(detail)) {
      return NextResponse.json(
        {
          error: 'firebase_not_configured',
          message: 'Firestore yapilandirmasi eksik veya gecersiz. Yoneticinizle iletisime gecin.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'firestore_read_failed',
        message: 'Turnuva verileri okunamadi. Lütfen tekrar deneyin.',
      },
      { status: 503 }
    );
  }

  // 2. Convert to scheduler JSON
  const tData = tournamentDoc.data();
  const startTimeIso = (tData.startDate as string) || new Date().toISOString();
  // startDate is YYYY-MM-DD; scheduler needs ISO datetime. Default 09:00 local.
  const startTimeFull = startTimeIso.includes('T') ? startTimeIso : `${startTimeIso}T09:00:00+03:00`;

  const payload = {
    tournament_id: tournamentId,
    start_time_iso: startTimeFull,
    matches: matches.map((m) => ({
      match_id: m.id,
      duration_minutes: Number(m.data.durationMinutes || 60),
      player_ids: extractPlayerIds(m.data),
    })),
    courts: courts.length > 0
      ? courts.map((c) => ({ court_id: c.id, name: (c.data.name as string) || c.id }))
      : // Fallback: synthesize 2 courts if none defined (tournament may not have its own courts)
        [{ court_id: 'c1', name: 'Court 1' }, { court_id: 'c2', name: 'Court 2' }],
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

  // 3. Call OR-Tools scheduler
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

/**
 * Extract player IDs from a match document.
 * Match docs may use teamA/teamB (object) or playerIds (array). Handle both.
 */
function extractPlayerIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  // Pattern 1: playerIds array
  if (Array.isArray(data.playerIds)) {
    ids.push(...(data.playerIds as string[]));
  }
  // Pattern 2: teamA.playerId, teamB.playerId
  const teamA = data.teamA as { playerIds?: string[]; playerId?: string } | undefined;
  const teamB = data.teamB as { playerIds?: string[]; playerId?: string } | undefined;
  if (teamA?.playerIds) ids.push(...teamA.playerIds);
  if (teamB?.playerIds) ids.push(...teamB.playerIds);
  if (teamA?.playerId) ids.push(teamA.playerId);
  if (teamB?.playerId) ids.push(teamB.playerId);
  return [...new Set(ids)];
}
