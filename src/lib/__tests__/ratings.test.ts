import { describe, it, expect } from 'vitest';
import { calculateRatingDelta } from '../ratings';

const baseInput = {
  playerRating: 1500,
  opponentRating: 1500,
  isWin: true,
  stage: 'early' as const,
  streakCount: 0,
  sportType: 'padel',
};

describe('calculateRatingDelta()', () => {
  it('returns 0 for a tie between equal ratings with no win', () => {
    const delta = calculateRatingDelta({ ...baseInput, isWin: false });
    // expectedScore = 0.5, actual = 0 → K * (0 - 0.5) = -16, rounded
    expect(delta).toBe(-16);
  });

  it('awards positive delta for upset win (lower rated beats higher)', () => {
    // player 1300 beats opponent 1700: massive upset
    const delta = calculateRatingDelta({
      ...baseInput,
      playerRating: 1300,
      opponentRating: 1700,
    });
    // expected ~ 0.09, actual 1 → K * (1 - 0.09) = +29
    expect(delta).toBeGreaterThan(25);
    expect(delta).toBeLessThan(35);
  });

  it('penalizes expected win (higher rated beats lower)', () => {
    const delta = calculateRatingDelta({
      ...baseInput,
      playerRating: 1700,
      opponentRating: 1300,
    });
    // expected ~ 0.91, actual 1 → K * (1 - 0.91) = +3
    expect(delta).toBeLessThan(10);
    expect(delta).toBeGreaterThan(0);
  });

  it('multiplies delta by stage weight (finals > early)', () => {
    const early = calculateRatingDelta({ ...baseInput, stage: 'early' });
    const finals = calculateRatingDelta({ ...baseInput, stage: 'finals' });
    expect(finals).toBeGreaterThan(early);
    // finals weight 2.0 vs early 1.0 — should be ~2x
    expect(finals).toBe(Math.round(early * 2));
  });

  it('applies streak bonus only on wins with streak >= threshold', () => {
    const noStreak = calculateRatingDelta({ ...baseInput, streakCount: 0 });
    const withStreak = calculateRatingDelta({ ...baseInput, streakCount: 5 });
    expect(withStreak).toBeGreaterThan(noStreak);
    // ratio ≈ 1.1 (streakBonus)
    expect(withStreak).toBe(Math.round(noStreak * 1.1));
  });

  it('does NOT apply streak bonus on losses', () => {
    const lossNoStreak = calculateRatingDelta({ ...baseInput, isWin: false, streakCount: 0 });
    const lossWithStreak = calculateRatingDelta({ ...baseInput, isWin: false, streakCount: 5 });
    expect(lossNoStreak).toBe(lossWithStreak);
  });

  it('accepts custom config (kFactor, streakThreshold, streakBonus)', () => {
    const defaultDelta = calculateRatingDelta(baseInput);
    const customDelta = calculateRatingDelta(baseInput, { kFactor: 64, streakThreshold: 3, streakBonus: 1.1 });
    // doubled K → doubled delta
    expect(customDelta).toBe(defaultDelta * 2);
  });
});
