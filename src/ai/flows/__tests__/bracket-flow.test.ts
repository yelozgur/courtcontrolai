import { describe, it, expect } from 'vitest';
import { generateTournamentBracket, type BracketInput } from '../bracket-flow';

const baseInput = (overrides: Partial<BracketInput> = {}): BracketInput => ({
  tournamentId: 't-1',
  categoryId: 'c-1',
  categoryName: 'Men Singles',
  participants: [
    { id: 'p1', name: 'Alice', rating: 1500 },
    { id: 'p2', name: 'Bob', rating: 1400 },
    { id: 'p3', name: 'Carol', rating: 1300 },
    { id: 'p4', name: 'Dave', rating: 1200 },
  ],
  startDate: '2026-09-01',
  format: 'Single Elimination',
  ...overrides,
});

describe('generateTournamentBracket()', () => {
  it('returns no matches for fewer than 2 participants', async () => {
    const out = await generateTournamentBracket(
      baseInput({ participants: [{ id: 'p1', name: 'Solo', rating: 1500 }] })
    );
    expect(out.matches).toHaveLength(0);
    expect(out.totalRounds).toBe(0);
  });

  it('produces exactly 2 matches for 4 players (single elim, 2 rounds)', async () => {
    const out = await generateTournamentBracket(baseInput());
    const r1 = out.matches.filter((m) => m.round === 1);
    const r2 = out.matches.filter((m) => m.round === 2);
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(1);
    expect(out.totalRounds).toBe(2);
  });

  it('uses power-of-2 bracket size with byes for non-power-of-2 counts', async () => {
    // 3 players → bracket size 4 → 1 bye
    const out = await generateTournamentBracket(
      baseInput({ participants: [
        { id: 'p1', name: 'Alice', rating: 1500 },
        { id: 'p2', name: 'Bob', rating: 1400 },
        { id: 'p3', name: 'Carol', rating: 1300 },
      ]})
    );
    expect(out.totalRounds).toBe(2);
    expect(out.byePlayerIds).toHaveLength(1);
    expect(out.byePlayerIds[0]).toBe('p1'); // top-seeded gets the bye
    const byeMatch = out.matches.find((m) => m.isBye);
    expect(byeMatch).toBeDefined();
  });

  it('seeds highest rating against lowest rating (1 vs 4, 2 vs 3)', async () => {
    const out = await generateTournamentBracket(baseInput());
    const r1 = out.matches.filter((m) => m.round === 1).sort((a, b) => a.bracketPosition - b.bracketPosition);
    // Match 1: Alice (1500) vs Dave (1200)
    const m1 = r1[0];
    expect([m1.teamA?.id, m1.teamB?.id]).toContain('p1');
    expect([m1.teamA?.id, m1.teamB?.id]).toContain('p4');
  });

  it('wires R1 winner to R2 (winnerNextMatch)', async () => {
    const out = await generateTournamentBracket(baseInput());
    const r1 = out.matches.filter((m) => m.round === 1);
    for (const m of r1) {
      expect(m.winnerNextMatch).toEqual({ round: 2, bracketPosition: 1 });
    }
  });

  it('schedules multi-day tournament across days (R1 day 0, final day N-1)', async () => {
    const out = await generateTournamentBracket(
      baseInput({
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        participants: [
          { id: 'p1', name: 'A', rating: 1500 },
          { id: 'p2', name: 'B', rating: 1400 },
          { id: 'p3', name: 'C', rating: 1300 },
          { id: 'p4', name: 'D', rating: 1200 },
          { id: 'p5', name: 'E', rating: 1100 },
          { id: 'p6', name: 'F', rating: 1000 },
          { id: 'p7', name: 'G', rating: 900 },
          { id: 'p8', name: 'H', rating: 800 },
        ],
      })
    );
    expect(out.totalDays).toBe(3);
    const r1 = out.matches.filter((m) => m.round === 1);
    const final = out.matches.find((m) => m.round === 3);
    expect(r1[0].dayIndex).toBe(0);
    expect(final?.dayIndex).toBeGreaterThan(0);
  });

  it('all matches on day 0 for single-day tournament', async () => {
    const out = await generateTournamentBracket(baseInput({ startDate: '2026-09-01' }));
    expect(out.totalDays).toBe(1);
    for (const m of out.matches) {
      expect(m.dayIndex).toBe(0);
      expect(m.scheduledDate).toBe('2026-09-01');
    }
  });

  it('summary line is human-readable', async () => {
    const out = await generateTournamentBracket(baseInput());
    expect(out.summary).toContain('Men Singles');
    expect(out.summary).toContain('4 players');
    expect(out.summary).toContain('2 rounds');
  });
});
