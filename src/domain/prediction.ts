export type ParsedPrediction = {
  gameId?: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
};

const PREDICTION_REGEX = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '.-]{1,}?)\s+(\d{1,2})\s*[xX-]\s*(\d{1,2})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '.-]{1,}?)$/;

function normalizeTeamLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function parsePredictionText(message: string): ParsedPrediction | null {
  const normalized = message.trim().replace(/\s+/g, " ");
  const match = normalized.match(PREDICTION_REGEX);
  if (!match) return null;

  const [, homeTeam, homeGoals, awayGoals, awayTeam] = match;

  return {
    homeTeam: normalizeTeamLabel(homeTeam),
    awayTeam: normalizeTeamLabel(awayTeam),
    homeGoals: Number(homeGoals),
    awayGoals: Number(awayGoals),
  };
}
