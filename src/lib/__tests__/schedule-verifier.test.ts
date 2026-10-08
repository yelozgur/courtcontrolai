import { describe, it, expect } from 'vitest';
import { verifySchedule, type VerifierInput, type VerifierMatch, type VerifierCourt, type VerifierVenue } from '../schedule-verifier';

const START = '2026-10-12T09:00:00+03:00';

function makeMatch(overrides: Partial<VerifierMatch> & { match_id: string }): VerifierMatch {
  return {
    court_id: 'c1',
    start_time_iso: START,
    duration_minutes: 60,
    player_ids: ['p1', 'p2'],
    ...overrides,
  };
}

const defaultCourts: VerifierCourt[] = [
  { court_id: 'c1', venue_id: 'v1' },
  { court_id: 'c2', venue_id: 'v1' },
];

const defaultVenues: VerifierVenue[] = [
  {
    venue_id: 'v1',
    courts: ['c1', 'c2'],
    open_hours: { mon: [['09:00', '23:00']] },
  },
];

function goodInput(matchOverrides?: Partial<VerifierMatch>[]): VerifierInput {
  const matches = [
    makeMatch({ match_id: 'm1', start_time_iso: '2026-10-12T09:00:00+03:00', court_id: 'c1', player_ids: ['p1', 'p2'] }),
    makeMatch({ match_id: 'm2', start_time_iso: '2026-10-12T10:30:00+03:00', court_id: 'c1', player_ids: ['p3', 'p4'] }),
    makeMatch({ match_id: 'm3', start_time_iso: '2026-10-12T09:00:00+03:00', court_id: 'c2', player_ids: ['p5', 'p6'] }),
  ];
  if (matchOverrides) {
    matchOverrides.forEach((o, i) => {
      if (i < matches.length) Object.assign(matches[i], o);
    });
  }
  return {
    tournament_start_iso: START,
    margin_minutes: 30,
    matches,
    courts: defaultCourts,
    venues: defaultVenues,
  };
}

describe('schedule verifier', () => {
  it('accepts a valid schedule with no violations', () => {
    const result = verifySchedule(goodInput());
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects court conflict: two matches on the same court at the same time', () => {
    const input = goodInput([
      {},
      { match_id: 'm2', start_time_iso: '2026-10-12T09:00:00+03:00', court_id: 'c1' },
    ]);
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    const courtViolations = result.violations.filter((v) => v.rule === 'court_conflict');
    expect(courtViolations.length).toBeGreaterThanOrEqual(1);
    expect(courtViolations[0].match_ids).toContain('m1');
    expect(courtViolations[0].match_ids).toContain('m2');
  });

  it('detects player conflict: same player in two overlapping matches', () => {
    const input = goodInput([
      {},
      { match_id: 'm2', start_time_iso: '2026-10-12T09:00:00+03:00', court_id: 'c2', player_ids: ['p1', 'p7'] },
    ]);
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    const playerViolations = result.violations.filter((v) => v.rule === 'player_conflict');
    expect(playerViolations.length).toBeGreaterThanOrEqual(1);
    expect(playerViolations[0].player_id).toBe('p1');
  });

  it('detects rest time violation: player gap below margin', () => {
    const input = goodInput([
      {},
      { match_id: 'm2', start_time_iso: '2026-10-12T10:00:00+03:00', court_id: 'c2', player_ids: ['p1', 'p7'] },
    ]);
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    const restViolations = result.violations.filter((v) => v.rule === 'rest_time');
    expect(restViolations.length).toBeGreaterThanOrEqual(1);
    expect(restViolations[0].player_id).toBe('p1');
    expect(restViolations[0].detail).toContain('30min');
  });

  it('detects venue hours violation: match outside opening hours', () => {
    const input = goodInput([
      { match_id: 'm1', start_time_iso: '2026-10-12T07:00:00+03:00' },
    ]);
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    const venueViolations = result.violations.filter((v) => v.rule === 'venue_hours');
    expect(venueViolations.length).toBeGreaterThanOrEqual(1);
    expect(venueViolations[0].match_id).toBe('m1');
    expect(venueViolations[0].detail).toContain('outside venue');
  });

  it('detects venue closed all day', () => {
    const input: VerifierInput = {
      tournament_start_iso: START,
      margin_minutes: 30,
      matches: [makeMatch({ match_id: 'm1' })],
      courts: [{ court_id: 'c1', venue_id: 'v1' }],
      venues: [{ venue_id: 'v1', courts: ['c1'], open_hours: { mon: [] } }],
    };
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    const venueViolations = result.violations.filter((v) => v.rule === 'venue_hours');
    expect(venueViolations.length).toBe(1);
    expect(venueViolations[0].detail).toContain('closed all day');
  });

  it('detects match duration below category minimum', () => {
    const input = goodInput([
      { match_id: 'm1', duration_minutes: 30, category_match_minutes: 60 },
    ]);
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    const durViolations = result.violations.filter((v) => v.rule === 'match_duration');
    expect(durViolations.length).toBe(1);
    expect(durViolations[0].match_id).toBe('m1');
  });

  it('reports blocking constraint as the most common violation type', () => {
    const input = goodInput([
      { match_id: 'm1', start_time_iso: '2026-10-12T07:00:00+03:00' },
      { match_id: 'm2', start_time_iso: '2026-10-12T07:00:00+03:00', court_id: 'c2' },
      { match_id: 'm3', start_time_iso: '2026-10-12T07:00:00+03:00', court_id: 'c1', player_ids: ['p1', 'p2'] },
    ]);
    const result = verifySchedule(input);
    expect(result.valid).toBe(false);
    expect(result.blocking_constraint).toBeDefined();
    expect(result.blocking_constraint).toContain('Venue hours');
  });

  it('REGRESSION: a schedule that ignores venue opening hours is rejected', () => {
    const venue: VerifierVenue = {
      venue_id: 'v1',
      courts: ['c1'],
      open_hours: { mon: [['10:00', '18:00']] },
    };
    const matches: VerifierMatch[] = [
      makeMatch({
        match_id: 'm1',
        court_id: 'c1',
        start_time_iso: '2026-10-12T08:00:00+03:00',
        duration_minutes: 60,
        player_ids: ['p1', 'p2'],
      }),
    ];
    const result = verifySchedule({
      tournament_start_iso: START,
      margin_minutes: 30,
      matches,
      courts: [{ court_id: 'c1', venue_id: 'v1' }],
      venues: [venue],
    });
    expect(result.valid).toBe(false);
    const venueViolations = result.violations.filter((v) => v.rule === 'venue_hours');
    expect(venueViolations).toHaveLength(1);
    expect(venueViolations[0].match_id).toBe('m1');
    expect(venueViolations[0].detail).toContain('outside venue');
    expect(venueViolations[0].detail).toContain('10:00-18:00');
  });

  it('accepts a match exactly within venue hours', () => {
    const venue: VerifierVenue = {
      venue_id: 'v1',
      courts: ['c1'],
      open_hours: { mon: [['09:00', '10:00']] },
    };
    const matches: VerifierMatch[] = [
      makeMatch({
        match_id: 'm1',
        court_id: 'c1',
        start_time_iso: '2026-10-12T09:00:00+03:00',
        duration_minutes: 60,
        player_ids: ['p1', 'p2'],
      }),
    ];
    const result = verifySchedule({
      tournament_start_iso: START,
      margin_minutes: 30,
      matches,
      courts: [{ court_id: 'c1', venue_id: 'v1' }],
      venues: [venue],
    });
    expect(result.valid).toBe(true);
  });

  it('skips verification for courts with no venue info (open all day)', () => {
    const input: VerifierInput = {
      tournament_start_iso: START,
      margin_minutes: 30,
      matches: [makeMatch({ match_id: 'm1', start_time_iso: '2026-10-12T05:00:00+03:00' })],
      courts: [{ court_id: 'c1', venue_id: 'v1' }],
      venues: [{ venue_id: 'v1', courts: ['c1'], open_hours: {} }],
    };
    const result = verifySchedule(input);
    const venueViolations = result.violations.filter((v) => v.rule === 'venue_hours');
    expect(venueViolations).toHaveLength(0);
  });
});
