import { calculateBolaoPoints } from "../domain/scoring.js";
import { env } from "../config/env.js";
import { google } from "googleapis";
import {
  createPredictionRepository,
  createRankingRepository,
  createResultRepository,
} from "../sheets/predictionRepositoryFactory.js";
import type { RankingEntry } from "../sheets/types.js";

const predictionRepo = createPredictionRepository();
const resultRepo = createResultRepository();
const rankingRepo = createRankingRepository();

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function normalizeGameId(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+\.0$/.test(raw)) return raw.slice(0, -2);
  return raw;
}

async function loadParticipantNames(): Promise<Map<string, string>> {
  if (env.PERSISTENCE_PROVIDER !== "google_sheets") return new Map();
  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return new Map();
  }

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: GOOGLE_SCOPES,
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: "Participantes!A:B",
  });

  const rows = response.data.values ?? [];
  const map = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const id = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    if (!id) continue;
    map.set(id, name || id);
  }
  return map;
}

export type RankingConsolidationResult = {
  processed: number;
  ranking: RankingEntry[];
};

export async function consolidateRanking(): Promise<RankingConsolidationResult> {
  const [predictions, confirmedResults] = await Promise.all([
    predictionRepo.listPredictions(),
    resultRepo.listConfirmedResults(),
  ]);
  const participantNames = await loadParticipantNames();

  // Accumulate points per participant across all confirmed results
  const pointsMap = new Map<string, number>();

  for (const result of confirmedResults) {
    if (result.homeGoalsManual === null || result.awayGoalsManual === null) continue;

    const actual = { home: result.homeGoalsManual, away: result.awayGoalsManual };
    const resultGameId = normalizeGameId(result.gameId).toUpperCase();
    if (!resultGameId) continue;

    for (const prediction of predictions) {
      const expectedId = normalizeGameId(prediction.gameId).toUpperCase();
      if (!expectedId || resultGameId !== expectedId) continue;
      if (prediction.isDeleted) continue;

      const { points } = calculateBolaoPoints(
        { home: prediction.homeGoals, away: prediction.awayGoals },
        actual,
      );

      pointsMap.set(
        prediction.participantId,
        (pointsMap.get(prediction.participantId) ?? 0) + points,
      );
    }
  }

  // Persist updated totals
  for (const prediction of predictions) {
    if (!prediction.isDeleted && !pointsMap.has(prediction.participantId)) {
      pointsMap.set(prediction.participantId, 0);
    }
  }

  for (const participantId of participantNames.keys()) {
    if (!pointsMap.has(participantId)) {
      pointsMap.set(participantId, 0);
    }
  }

  for (const [participantId, totalPoints] of pointsMap.entries()) {
    const name = participantNames.get(participantId) ?? participantId;
    await rankingRepo.upsertEntry({ participantId, name, totalPoints });
  }

  const ranking = await rankingRepo.listRanking();
  return { processed: confirmedResults.length, ranking };
}

export async function getRanking(): Promise<RankingEntry[]> {
  return rankingRepo.listRanking();
}
