
/**
 * @fileOverview Custom performance-based rating system for CourtControl AI.
 * 
 * Formula: NewRating = OldRating + (K * (Outcome - ExpectedScore) * StageMultiplier * StreakBonus)
 */

export interface RatingImpact {
  playerRating: number;
  opponentRating: number;
  isWin: boolean;
  stage: 'early' | 'quarters' | 'semis' | 'finals';
  streakCount: number;
  sportType: string;
}

const STAGE_WEIGHTS = {
  early: 1.0,
  quarters: 1.2,
  semis: 1.5,
  finals: 2.0
};

/**
 * Calculates the rating delta for a match result.
 * Safeguard: Coefficients are passed as optional overrides to allow dynamic tuning.
 */
export function calculateRatingDelta(
  impact: RatingImpact, 
  config = { kFactor: 32, streakThreshold: 3, streakBonus: 1.1 }
): number {
  const { playerRating, opponentRating, isWin, stage, streakCount } = impact;

  // Expected score based on rating difference
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actualScore = isWin ? 1 : 0;

  let delta = config.kFactor * (actualScore - expectedScore);

  // Apply Tournament Stage Weight
  delta *= STAGE_WEIGHTS[stage] || 1.0;

  // Apply Consistency/Streak Bonus
  if (isWin && streakCount >= config.streakThreshold) {
    delta *= config.streakBonus;
  }

  return Math.round(delta);
}
