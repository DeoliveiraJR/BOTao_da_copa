import { google } from "googleapis";
import type { ParsedPrediction } from "../domain/prediction.js";
import type { PredictionRepository, StoredPrediction } from "./types.js";

type GoogleSheetsConfig = {
  spreadsheetId: string;
  predictionsRange: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export class GoogleSheetsPredictionRepository implements PredictionRepository {
  private readonly config: GoogleSheetsConfig;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
  }

  private async getClient() {
    const auth = new google.auth.JWT({
      email: this.config.serviceAccountEmail,
      key: this.config.serviceAccountPrivateKey,
      scopes: GOOGLE_SCOPES,
    });

    return google.sheets({ version: "v4", auth });
  }

  async savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
    const sheets = await this.getClient();
    const createdAt = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: this.config.predictionsRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            createdAt,
            participantId,
            prediction.homeTeam,
            prediction.homeGoals,
            prediction.awayGoals,
            prediction.awayTeam,
            "whatsapp",
          ],
        ],
      },
    });
  }

  async listPredictions(): Promise<StoredPrediction[]> {
    const sheets = await this.getClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: this.config.predictionsRange,
    });

    const rows = response.data.values ?? [];
    const dataRows = rows.slice(1);

    return dataRows
      .map((row) => {
        const [createdAt, participantId, homeTeam, homeGoals, awayGoals, awayTeam, source] = row;

        if (!participantId || !homeTeam || !awayTeam || !homeGoals || !awayGoals) {
          return null;
        }

        return {
          createdAt: createdAt ?? new Date().toISOString(),
          participantId: String(participantId),
          homeTeam: String(homeTeam),
          homeGoals: Number(homeGoals),
          awayGoals: Number(awayGoals),
          awayTeam: String(awayTeam),
          source: source === "whatsapp" ? "whatsapp" : "whatsapp",
        } satisfies StoredPrediction;
      })
      .filter((item): item is StoredPrediction => item !== null);
  }
}
