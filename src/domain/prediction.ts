export type ParsedPrediction = {
  gameId?: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
};

const PREDICTION_REGEX = /^([A-Za-z]{2,})\s*(\d{1,2})\s*[xX-]\s*(\d{1,2})\s*([A-Za-z]{2,})$/;

export function parsePredictionText(message: string): ParsedPrediction | null {
  const normalized = message.trim().replace(/\s+/g, " ");
  const match = normalized.match(PREDICTION_REGEX);
  if (!match) return null;

  const [, homeTeam, homeGoals, awayGoals, awayTeam] = match;

  return {
    homeTeam: homeTeam.toUpperCase(),
    awayTeam: awayTeam.toUpperCase(),
    homeGoals: Number(homeGoals),
    awayGoals: Number(awayGoals),
  };
}
