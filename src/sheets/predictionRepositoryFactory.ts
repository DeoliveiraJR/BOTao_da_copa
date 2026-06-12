import { env } from "../config/env.js";
import { GoogleSheetsPredictionRepository } from "./googleSheetsPredictionRepository.js";
import { InMemoryPredictionRepository } from "./inMemoryPredictionRepository.js";
import type { PredictionRepository } from "./types.js";

const inMemoryRepository = new InMemoryPredictionRepository();

function getRequired(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createPredictionRepository(): PredictionRepository {
  if (env.PERSISTENCE_PROVIDER === "google_sheets") {
    const privateKey = getRequired(
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ).replace(/\\n/g, "\n");

    return new GoogleSheetsPredictionRepository({
      spreadsheetId: getRequired(env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID"),
      predictionsRange: env.GOOGLE_SHEETS_PREDICTIONS_RANGE,
      serviceAccountEmail: getRequired(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      serviceAccountPrivateKey: privateKey,
    });
  }

  return inMemoryRepository;
}
