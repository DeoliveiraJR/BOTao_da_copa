import { google } from "googleapis";
import type { GameRepository, GameStatus, StoredGame } from "./types.js";

type GoogleSheetsConfig = {
  spreadsheetId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
};

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const RANGE = "Jogos!A:J";

function normalizeStatus(value: string): GameStatus {
  const v = value.toLowerCase();
  if (v === "in_progress") return "in_progress";
  if (v === "finished") return "finished";
  return "scheduled";
}

function toIso(dateBr?: string, hourBr?: string): string | null {
  if (!dateBr) return null;
  if (!hourBr) return null;
  const d = String(dateBr).trim();
  const h = String(hourBr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(h)) return null;
  return `${d}T${h}:00-03:00`;
}

export class GoogleSheetsGameRepository implements GameRepository {
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

  private async loadGames(): Promise<StoredGame[]> {
    const sheets = await this.getClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: RANGE,
    });

    const rows = response.data.values ?? [];
    if (rows.length <= 1) return [];

    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);

    const idxId = col("id_jogo");
    const idxRound = col("rodada");
    const idxDateTime = col("data_hora");
    const idxDate = col("data_brt");
    const idxHour = col("hora_brt");
    const idxHome = col("time_casa");
    const idxAway = col("time_fora");
    const idxStatus = col("status");
    const idxSource = col("fonte");
    const idxUpdatedAt = col("updated_at");

    return rows.slice(1)
      .map((row) => {
        const homeTeam = String((idxHome >= 0 ? row[idxHome] : "") ?? "").trim();
        const awayTeam = String((idxAway >= 0 ? row[idxAway] : "") ?? "").trim();
        if (!homeTeam || !awayTeam) return null;

        const legacyDateTime = idxDateTime >= 0 ? String(row[idxDateTime] ?? "").trim() : "";
        const dateBr = idxDate >= 0 ? String(row[idxDate] ?? "").trim() : "";
        const hourBr = idxHour >= 0 ? String(row[idxHour] ?? "").trim() : "";
        const dateTime = legacyDateTime || toIso(dateBr, hourBr) || new Date().toISOString();
        const id = String((idxId >= 0 ? row[idxId] : "") ?? "").trim() || `${homeTeam.toUpperCase()}-${awayTeam.toUpperCase()}`;

        return {
          id,
          round: String((idxRound >= 0 ? row[idxRound] : "") ?? "").trim() || "N/A",
          dateTime,
          homeTeam,
          awayTeam,
          status: normalizeStatus(String((idxStatus >= 0 ? row[idxStatus] : "scheduled") ?? "scheduled")),
          source: String((idxSource >= 0 ? row[idxSource] : "manual") ?? "manual").trim() || "manual",
          updatedAt: String((idxUpdatedAt >= 0 ? row[idxUpdatedAt] : "") ?? "").trim() || new Date().toISOString(),
        } satisfies StoredGame;
      })
      .filter((g): g is StoredGame => g !== null);
  }

  async listGames(): Promise<StoredGame[]> {
    return this.loadGames();
  }

  async listByRound(round: string): Promise<StoredGame[]> {
    const games = await this.loadGames();
    return games.filter((g) => g.round === round);
  }

  async listUpcoming(limitHours: number): Promise<StoredGame[]> {
    const games = await this.loadGames();
    const now = Date.now();
    const limit = limitHours * 60 * 60 * 1000;
    return games.filter((g) => {
      const diff = new Date(g.dateTime).getTime() - now;
      return diff > 0 && diff <= limit;
    });
  }

  async findGame(homeTeam: string, awayTeam: string): Promise<StoredGame | null> {
    const games = await this.loadGames();
    return (
      games.find(
        (g) =>
          g.homeTeam.toUpperCase() === homeTeam.toUpperCase() &&
          g.awayTeam.toUpperCase() === awayTeam.toUpperCase(),
      ) ?? null
    );
  }
}
