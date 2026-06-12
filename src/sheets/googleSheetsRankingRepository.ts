import { google } from "googleapis";
import type { RankingEntry, RankingRepository } from "./types.js";

type GoogleSheetsConfig = {
  spreadsheetId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// columns: posicao | id_usuario | nome | pontos_total | updated_at
const RANGE = "Ranking!A:E";

type RowEntry = { rowIndex: number; data: Omit<RankingEntry, "position"> };

export class GoogleSheetsRankingRepository implements RankingRepository {
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
        const participantId = String(row[1] ?? "").trim();
        if (!participantId) return null;
        return {
          rowIndex: i + 2,
          data: {
            participantId,
            name: String(row[2] ?? participantId),
            totalPoints: Number(row[3] ?? 0),
            updatedAt: String(row[4] ?? ""),
          },
        };
      })
      .filter((r): r is RowEntry => r !== null);
  }

  async upsertEntry(entry: Omit<RankingEntry, "position" | "updatedAt">): Promise<void> {
    const sheets = await this.getClient();
    const updatedAt = new Date().toISOString();
    // Position placeholder (0); it will be recalculated on listRanking
    const row = [0, entry.participantId, entry.name, entry.totalPoints, updatedAt];

    const existing = await this.getAllRows();
    const found = existing.find((r) => r.data.participantId === entry.participantId);

    if (found) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `Ranking!A${found.rowIndex}:E${found.rowIndex}`,
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

  async listRanking(): Promise<RankingEntry[]> {
    const rows = await this.getAllRows();
    return rows
      .sort((a, b) => b.data.totalPoints - a.data.totalPoints)
      .map((r, index) => ({ ...r.data, position: index + 1 }));
  }
}
