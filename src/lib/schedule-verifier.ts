export interface VerifierMatch {
  match_id: string;
  court_id: string;
  start_time_iso: string;
  duration_minutes: number;
  player_ids: string[];
  category_match_minutes?: number;
}

export interface VerifierCourt {
  court_id: string;
  venue_id: string;
}

export interface VerifierVenue {
  venue_id: string;
  courts: string[];
  open_hours: Record<string, string[][]>;
}

export interface VerifierInput {
  tournament_start_iso: string;
  margin_minutes: number;
  matches: VerifierMatch[];
  courts: VerifierCourt[];
  venues: VerifierVenue[];
}

export interface Violation {
  rule: string;
  match_id?: string;
  match_ids?: string[];
  player_id?: string;
  court_id?: string;
  detail: string;
}

export interface VerificationResult {
  valid: boolean;
  violations: Violation[];
  blocking_constraint?: string;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function weekdayKey(iso: string): string {
  const d = new Date(iso);
  return WEEKDAY_KEYS[(d.getDay() + 6) % 7];
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function addMinutes(iso: string, mins: number): Date {
  return new Date(new Date(iso).getTime() + mins * 60_000);
}

function overlaps(a: VerifierMatch, b: VerifierMatch): boolean {
  const aStart = new Date(a.start_time_iso).getTime();
  const aEnd = aStart + a.duration_minutes * 60_000;
  const bStart = new Date(b.start_time_iso).getTime();
  const bEnd = bStart + b.duration_minutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

function checkCourtConflicts(matches: VerifierMatch[]): Violation[] {
  const violations: Violation[] = [];
  const byCourt: Record<string, VerifierMatch[]> = {};
  for (const m of matches) {
    (byCourt[m.court_id] ??= []).push(m);
  }
  for (const [courtId, courtMatches] of Object.entries(byCourt)) {
    courtMatches.sort((a, b) => a.start_time_iso.localeCompare(b.start_time_iso));
    for (let i = 0; i < courtMatches.length - 1; i++) {
      if (overlaps(courtMatches[i], courtMatches[i + 1])) {
        violations.push({
          rule: 'court_conflict',
          match_ids: [courtMatches[i].match_id, courtMatches[i + 1].match_id],
          court_id: courtId,
          detail: `Matches ${courtMatches[i].match_id} and ${courtMatches[i + 1].match_id} overlap on court ${courtId}`,
        });
      }
    }
  }
  return violations;
}

function checkPlayerConflicts(matches: VerifierMatch[]): Violation[] {
  const violations: Violation[] = [];
  const byPlayer: Record<string, VerifierMatch[]> = {};
  for (const m of matches) {
    for (const pid of m.player_ids) {
      (byPlayer[pid] ??= []).push(m);
    }
  }
  for (const [pid, playerMatches] of Object.entries(byPlayer)) {
    playerMatches.sort((a, b) => a.start_time_iso.localeCompare(b.start_time_iso));
    for (let i = 0; i < playerMatches.length - 1; i++) {
      if (overlaps(playerMatches[i], playerMatches[i + 1])) {
        violations.push({
          rule: 'player_conflict',
          match_ids: [playerMatches[i].match_id, playerMatches[i + 1].match_id],
          player_id: pid,
          detail: `Player ${pid} is double-booked in matches ${playerMatches[i].match_id} and ${playerMatches[i + 1].match_id}`,
        });
      }
    }
  }
  return violations;
}

function checkRestTime(matches: VerifierMatch[], marginMinutes: number): Violation[] {
  const violations: Violation[] = [];
  const byPlayer: Record<string, VerifierMatch[]> = {};
  for (const m of matches) {
    for (const pid of m.player_ids) {
      (byPlayer[pid] ??= []).push(m);
    }
  }
  for (const [pid, playerMatches] of Object.entries(byPlayer)) {
    playerMatches.sort((a, b) => a.start_time_iso.localeCompare(b.start_time_iso));
    for (let i = 0; i < playerMatches.length - 1; i++) {
      const endA = addMinutes(playerMatches[i].start_time_iso, playerMatches[i].duration_minutes);
      const startB = new Date(playerMatches[i + 1].start_time_iso);
      const gap = (startB.getTime() - endA.getTime()) / 60_000;
      if (gap < marginMinutes) {
        violations.push({
          rule: 'rest_time',
          match_ids: [playerMatches[i].match_id, playerMatches[i + 1].match_id],
          player_id: pid,
          detail: `Player ${pid} has only ${Math.round(gap)}min rest between matches ${playerMatches[i].match_id} and ${playerMatches[i + 1].match_id} (required: ${marginMinutes}min)`,
        });
      }
    }
  }
  return violations;
}

function checkVenueHours(matches: VerifierMatch[], courts: VerifierCourt[], venues: VerifierVenue[]): Violation[] {
  const violations: Violation[] = [];
  const courtToVenue = new Map<string, string>();
  for (const c of courts) {
    courtToVenue.set(c.court_id, c.venue_id);
  }
  const venueMap = new Map<string, VerifierVenue>();
  for (const v of venues) {
    venueMap.set(v.venue_id, v);
  }

  for (const m of matches) {
    const venueId = courtToVenue.get(m.court_id);
    if (!venueId) continue;
    const venue = venueMap.get(venueId);
    if (!venue) continue;

    const wd = weekdayKey(m.start_time_iso);
    const ranges = venue.open_hours[wd];
    if (ranges === undefined) continue;
    if (ranges.length === 0) {
      violations.push({
        rule: 'venue_hours',
        match_id: m.match_id,
        court_id: m.court_id,
        detail: `Match ${m.match_id} is on court ${m.court_id} but venue ${venueId} is closed all day on ${wd}`,
      });
      continue;
    }

    const startDt = new Date(m.start_time_iso);
    const endDt = addMinutes(m.start_time_iso, m.duration_minutes);
    const startMin = startDt.getHours() * 60 + startDt.getMinutes();
    const endMin = endDt.getHours() * 60 + endDt.getMinutes() + (endDt.getSeconds() > 0 ? 1 : 0);

    const insideAnyRange = ranges.some(([from, to]) => {
      const fromMin = timeToMinutes(from);
      const toMin = timeToMinutes(to);
      return startMin >= fromMin && endMin <= toMin;
    });

    if (!insideAnyRange) {
      violations.push({
        rule: 'venue_hours',
        match_id: m.match_id,
        court_id: m.court_id,
        detail: `Match ${m.match_id} at ${m.start_time_iso} (${startMin}-${endMin}min) is outside venue ${venueId} hours on ${wd}: ${ranges.map(([f, t]) => `${f}-${t}`).join(', ')}`,
      });
    }
  }
  return violations;
}

function checkMatchDuration(matches: VerifierMatch[]): Violation[] {
  const violations: Violation[] = [];
  for (const m of matches) {
    const minDuration = m.category_match_minutes ?? 60;
    if (m.duration_minutes < minDuration) {
      violations.push({
        rule: 'match_duration',
        match_id: m.match_id,
        detail: `Match ${m.match_id} duration ${m.duration_minutes}min is below category minimum ${minDuration}min`,
      });
    }
  }
  return violations;
}

function describeBlockingConstraint(violations: Violation[]): string | undefined {
  if (violations.length === 0) return undefined;
  const ruleCounts: Record<string, number> = {};
  for (const v of violations) {
    ruleCounts[v.rule] = (ruleCounts[v.rule] || 0) + 1;
  }
  const dominant = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])[0];
  const ruleLabels: Record<string, string> = {
    court_conflict: 'Court conflict: two matches assigned to the same court at the same time',
    player_conflict: 'Player conflict: a player is assigned to two overlapping matches',
    rest_time: 'Rest time: a player does not have enough rest between consecutive matches',
    venue_hours: 'Venue hours: a match is scheduled outside the venue opening hours',
    match_duration: 'Match duration: a match is shorter than the category minimum',
  };
  return ruleLabels[dominant[0]] ?? `${dominant[1]} violation(s) of type ${dominant[0]}`;
}

export function verifySchedule(input: VerifierInput): VerificationResult {
  const violations: Violation[] = [
    ...checkCourtConflicts(input.matches),
    ...checkPlayerConflicts(input.matches),
    ...checkRestTime(input.matches, input.margin_minutes),
    ...checkVenueHours(input.matches, input.courts, input.venues),
    ...checkMatchDuration(input.matches),
  ];

  return {
    valid: violations.length === 0,
    violations,
    blocking_constraint: describeBlockingConstraint(violations),
  };
}
