import { google } from "googleapis";
import type { ReconciliationStatus, ResultRepository, StoredResult } from "./types.js";

type GoogleSheetsConfig = {
  spreadsheetId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// columns: id_jogo | gols_casa_api | gols_fora_api | gols_casa_manual | gols_fora_manual | status_reconciliacao | updated_at
const RANGE = "Resultados!A:G";

type RowEntry = { rowIndex: number; data: StoredResult };

function parseNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export class GoogleSheetsResultRepository implements ResultRepository {
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

  private async getAllRows(): Promise<RowEntry[]> {
    const sheets = await this.getClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: RANGE,
    });

    const rows = response.data.values ?? [];
    return rows
      .slice(1) // skip header
      .map((row, i): RowEntry | null => {
        const gameId = String(row[0] ?? "").trim();
        if (!gameId) return null;
        return {
          rowIndex: i + 2, // 1-based row index; row 1 = header
          data: {
            gameId,
            homeGoalsApi: parseNull(row[1]),
            awayGoalsApi: parseNull(row[2]),
            homeGoalsManual: parseNull(row[3]),
            awayGoalsManual: parseNull(row[4]),
            reconciliationStatus: (String(row[5] ?? "pending")) as ReconciliationStatus,
            updatedAt: String(row[6] ?? ""),
          },
        };
      })
      .filter((r): r is RowEntry => r !== null);
  }

  async saveResult(result: Omit<StoredResult, "updatedAt">): Promise<void> {
    const sheets = await this.getClient();
    const updatedAt = new Date().toISOString();
    const row = [
      result.gameId,
      result.homeGoalsApi ?? "",
      result.awayGoalsApi ?? "",
      result.homeGoalsManual ?? "",
      result.awayGoalsManual ?? "",
      result.reconciliationStatus,
      updatedAt,
    ];

    const existing = await this.getAllRows();
    const found = existing.find((r) => r.data.gameId === result.gameId);

    if (found) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `Resultados!A${found.rowIndex}:G${found.rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: RANGE,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
    }
  }

  async getResult(gameId: string): Promise<StoredResult | null> {
    const rows = await this.getAllRows();
    return rows.find((r) => r.data.gameId === gameId)?.data ?? null;
  }

  async listConfirmedResults(): Promise<StoredResult[]> {
    const rows = await this.getAllRows();
    return rows.filter((r) => r.data.reconciliationStatus === "confirmed").map((r) => r.data);
  }
}
