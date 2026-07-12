'use server';
/**
 * @fileOverview Tournament Bracket Generator
 *
 * Deterministic, multi-day bracket generation. LLM çıkarıldı — bracket math
 * LLM'e bırakılamayacak kadar hassas. AI flow sadece strateji parse için
 * kullanılır (kategori öncelik, location tercihi).
 *
 * Multi-day mantığı:
 * - Participant sayısından round sayısı hesaplanır: ceil(log2(n))
 * - Round'lar güne yayılır: round 1 = day 0, round 2 = day 1, ...
 * - Eğer tournament tek günse (endDate yoksa), tüm round'lar day 0'da
 * - Eğer tournament multi-day ise, round'lar günlere round-robin dağıtılır
 * - Bye logic: power-of-2'ye tamamlayana kadar top-seeded'lara bye verilir
 */

import { z } from 'zod';

const ParticipantInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number()
});

const BracketInputSchema = z.object({
  tournamentId: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  participants: z.array(ParticipantInputSchema),
  startDate: z.string(),  // ISO date "YYYY-MM-DD"
  endDate: z.string().optional(),  // ISO date, multi-day için
  format: z.enum(['Single Elimination', 'Double Elimination']).default('Single Elimination')
});

const MatchDraftSchema = z.object({
  round: z.number(),
  bracketPosition: z.number(),
  dayIndex: z.number(),
  scheduledDate: z.string().optional(),  // ISO date
  teamA: z.object({ id: z.string(), name: z.string() }).optional(),
  teamB: z.object({ id: z.string(), name: z.string() }).optional(),
  isBye: z.boolean(),
  byePlayerId: z.string().optional(),
  winnerNextMatch: z.object({ round: z.number(), bracketPosition: z.number() }).optional()
});

const BracketOutputSchema = z.object({
  matches: z.array(MatchDraftSchema),
  totalRounds: z.number(),
  totalDays: z.number(),
  byePlayerIds: z.array(z.string()),
  summary: z.string()
});

/**
 * Calculate total number of rounds needed for given participant count.
 * Single elimination: ceil(log2(n))
 */
function calculateRounds(participantCount: number): number {
  if (participantCount < 2) return 0;
  return Math.ceil(Math.log2(participantCount));
}

/**
 * Calculate number of days in tournament.
 */
function calculateDays(startDate: string, endDate?: string): number {
  if (!endDate) return 1;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (end < start) return 1;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Standard bracket seeding: highest seed plays lowest seed.
 * Position 1 vs 16, 8 vs 9, 4 vs 13, 5 vs 12, etc.
 */
function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedOrder(n / 2);
  const result: number[] = [];
  for (const p of prev) {
    result.push(p);
    result.push(n + 1 - p);
  }
  return result;
}

/**
 * Add ISO date offset.
 */
function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export type BracketInput = z.infer<typeof BracketInputSchema>;
export type BracketOutput = z.infer<typeof BracketOutputSchema>;
export type MatchDraft = z.infer<typeof MatchDraftSchema>;

/**
 * Generate tournament bracket with multi-day support.
 *
 * Returns R1 match drafts with bye assignments, plus day scheduling for
 * subsequent rounds. Day assignment: round i → day (i-1) * (totalDays / totalRounds).
 */
export async function generateTournamentBracket(input: BracketInput): Promise<BracketOutput> {
  const { participants, startDate, endDate, format, categoryName } = input;

  const totalRounds = calculateRounds(participants.length);
  const totalDays = calculateDays(startDate, endDate);

  // Sort by rating (highest first) for seeding
  const sorted = [...participants].sort((a, b) => b.rating - a.rating);

  // Power of 2 bracket size (next power of 2 ≥ participants.length)
  const bracketSize = Math.pow(2, totalRounds);
  const byeCount = bracketSize - participants.length;

  // Bye player IDs (top-seeded get byes)
  const byePlayerIds = sorted.slice(0, byeCount).map(p => p.id);

  // Seeding order
  const seedPositions = seedOrder(bracketSize);

  // R1 match drafts
  const matches: MatchDraft[] = [];
  let matchIdx = 0;

  for (let i = 0; i < bracketSize; i += 2) {
    const posA = seedPositions[i] - 1;  // 0-indexed
    const posB = seedPositions[i + 1] - 1;

    const playerA = sorted[posA];
    const playerB = sorted[posB];

    const isByeMatch = !playerA || !playerB;
    const byePlayerId = !playerA ? byePlayerIds.find(() => true) : !playerB ? byePlayerIds.find(() => true) : undefined;

    // R1 day = day 0
    matches.push({
      round: 1,
      bracketPosition: matchIdx + 1,
      dayIndex: 0,
      scheduledDate: startDate,
      teamA: playerA ? { id: playerA.id, name: playerA.name } : undefined,
      teamB: playerB ? { id: playerB.id, name: playerB.name } : undefined,
      isBye: isByeMatch,
      byePlayerId: byePlayerId,
      // Winner advances to R2 (or R1 if format is double elim, but single for now)
      winnerNextMatch: totalRounds >= 2 ? { round: 2, bracketPosition: Math.floor(matchIdx / 2) + 1 } : undefined
    });

    matchIdx++;
  }

  // Multi-day scheduling for subsequent rounds
  if (totalRounds >= 2 && totalDays > 1) {
    // Distribute rounds across days. Heuristic: front-load R1, then daily pace.
    // Day assignment: round r → day (r-1) * (totalDays - 1) / (totalRounds - 1)
    for (let r = 2; r <= totalRounds; r++) {
      const dayIndex = Math.min(
        totalDays - 1,
        Math.round((r - 1) * (totalDays - 1) / Math.max(totalRounds - 1, 1))
      );
      const scheduledDate = addDays(startDate, dayIndex);

      const matchesInRound = bracketSize / Math.pow(2, r);
      for (let p = 1; p <= matchesInRound; p++) {
        matches.push({
          round: r,
          bracketPosition: p,
          dayIndex,
          scheduledDate,
          isBye: false,
          winnerNextMatch: r < totalRounds ? {
            round: r + 1,
            bracketPosition: Math.ceil(p / 2)
          } : undefined
        });
      }
    }
  } else if (totalRounds >= 2) {
    // Single day: all rounds day 0
    for (let r = 2; r <= totalRounds; r++) {
      const matchesInRound = bracketSize / Math.pow(2, r);
      for (let p = 1; p <= matchesInRound; p++) {
        matches.push({
          round: r,
          bracketPosition: p,
          dayIndex: 0,
          scheduledDate: startDate,
          isBye: false,
          winnerNextMatch: r < totalRounds ? {
            round: r + 1,
            bracketPosition: Math.ceil(p / 2)
          } : undefined
        });
      }
    }
  }

  return {
    matches,
    totalRounds,
    totalDays,
    byePlayerIds,
    summary: `${categoryName}: ${participants.length} players, ${totalRounds} rounds, ${totalDays} day(s), ${byeCount} bye(s).`
  };
}
