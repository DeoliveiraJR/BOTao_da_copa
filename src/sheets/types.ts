import type { ParsedPrediction } from "../domain/prediction.js";

// ── Palpites ──────────────────────────────────────────────────────────────────

export type StoredPrediction = ParsedPrediction & {
  participantId: string;
  source: "whatsapp";
  createdAt: string;
};

export interface PredictionRepository {
  savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void>;
  listPredictions(): Promise<StoredPrediction[]>;
  hasPrediction(participantId: string, homeTeam: string, awayTeam: string): Promise<boolean>;
}

// ── Jogos ─────────────────────────────────────────────────────────────────────

export type GameStatus = "scheduled" | "in_progress" | "finished";

export type StoredGame = {
  id: string;
  round: string;
  dateTime: string;           // ISO 8601, timezone BRT
  homeTeam: string;
  awayTeam: string;
  status: GameStatus;
  source: string;
  updatedAt: string;
};

export interface GameRepository {
  listGames(): Promise<StoredGame[]>;
  listByRound(round: string): Promise<StoredGame[]>;
  listUpcoming(limitHours: number): Promise<StoredGame[]>;
  findGame(homeTeam: string, awayTeam: string): Promise<StoredGame | null>;
}

// ── Resultados ────────────────────────────────────────────────────────────────

export type ReconciliationStatus = "pending" | "confirmed" | "conflict";

export type StoredResult = {
  gameId: string;
  homeGoalsApi: number | null;
  awayGoalsApi: number | null;
  homeGoalsManual: number | null;
  awayGoalsManual: number | null;
  reconciliationStatus: ReconciliationStatus;
  updatedAt: string;
};

export interface ResultRepository {
  saveResult(result: Omit<StoredResult, "updatedAt">): Promise<void>;
  getResult(gameId: string): Promise<StoredResult | null>;
  listConfirmedResults(): Promise<StoredResult[]>;
}

// ── Ranking ───────────────────────────────────────────────────────────────────

export type RankingEntry = {
  position: number;
  participantId: string;
  name: string;
  totalPoints: number;
  updatedAt: string;
};

export interface RankingRepository {
  upsertEntry(entry: Omit<RankingEntry, "position" | "updatedAt">): Promise<void>;
  listRanking(): Promise<RankingEntry[]>;
}
