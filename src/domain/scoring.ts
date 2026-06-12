export type MatchScore = {
  home: number;
  away: number;
};

export type ScoreResult = {
  points: 0 | 1 | 3;
  reason: "exact" | "outcome" | "miss";
};

function outcome(score: MatchScore): "home" | "away" | "draw" {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return "draw";
}

export function calculateBolaoPoints(prediction: MatchScore, result: MatchScore): ScoreResult {
  const exact = prediction.home === result.home && prediction.away === result.away;
  if (exact) {
    return { points: 3, reason: "exact" };
  }

  const sameOutcome = outcome(prediction) === outcome(result);
  if (sameOutcome) {
    return { points: 1, reason: "outcome" };
  }

  return { points: 0, reason: "miss" };
}
