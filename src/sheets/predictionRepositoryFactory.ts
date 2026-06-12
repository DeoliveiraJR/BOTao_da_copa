import { env } from "../config/env.js";
import { GoogleSheetsPredictionRepository } from "./googleSheetsPredictionRepository.js";
import { InMemoryGameRepository } from "./inMemoryGameRepository.js";
import { InMemoryPredictionRepository } from "./inMemoryPredictionRepository.js";
import { InMemoryRankingRepository } from "./inMemoryRankingRepository.js";
import { InMemoryResultRepository } from "./inMemoryResultRepository.js";
import type { GameRepository, PredictionRepository, RankingRepository, ResultRepository } from "./types.js";

const inMemoryPrediction = new InMemoryPredictionRepository();
const inMemoryGame = new InMemoryGameRepository();
const inMemoryResult = new InMemoryResultRepository();
const inMemoryRanking = new InMemoryRankingRepository();

export function getRequired(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function googleSheetsConfig() {
  return {
    spreadsheetId: getRequired(env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID"),
    serviceAccountEmail: getRequired(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    serviceAccountPrivateKey: getRequired(
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ).replace(/\\n/g, "\n"),
  };
}

export function createPredictionRepository(): PredictionRepository {
  if (env.PERSISTENCE_PROVIDER === "google_sheets") {
    const base = googleSheetsConfig();
    return new GoogleSheetsPredictionRepository({
      ...base,
      predictionsRange: env.GOOGLE_SHEETS_PREDICTIONS_RANGE,
    });
  }
  return inMemoryPrediction;
}

export function createGameRepository(): GameRepository {
  // Google Sheets impl to be added in the next iteration
  return inMemoryGame;
}

export function createResultRepository(): ResultRepository {
  // Google Sheets impl to be added in the next iteration
  return inMemoryResult;
}

export function createRankingRepository(): RankingRepository {
  // Google Sheets impl to be added in the next iteration
  return inMemoryRanking;
}
