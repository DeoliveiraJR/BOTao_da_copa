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

type GameDirectoryEntry = {
  id: string;
  homeTeam: string;
  awayTeam: string;
};

function buildPredictionId(): string {
  return `pred-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildLegacyPredictionId(participantId: string, gameId: string, createdAt: string): string {
  const raw = `legacy-${participantId}-${gameId}-${createdAt}`;
  return raw.replace(/[^a-zA-Z0-9-]/g, "");
}

function normalizeBool(value: unknown): boolean {
  const v = String(value ?? "false").trim().toLowerCase();
  return v === "true" || v === "1" || v === "sim";
}

function isIsoDate(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function normalizeTeamName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function columnToLetter(column: number): string {
  let n = column;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function parseSheetName(range: string): string {
  const [rawSheet] = String(range).split("!");
  return rawSheet || "Palpites";
}

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

  private async loadGamesDirectory() {
    const sheets = await this.getClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: "Jogos!A:H",
    });

    const rows = response.data.values ?? [];
    const byId = new Map<string, GameDirectoryEntry>();
    const byTeams = new Map<string, GameDirectoryEntry>();

    for (const row of rows.slice(1)) {
      const entry = {
        id: String(row[0] ?? "").trim(),
        homeTeam: String(row[6] ?? "").trim(),
        awayTeam: String(row[7] ?? "").trim(),
      };
      if (!entry.id || !entry.homeTeam || !entry.awayTeam) continue;
      byId.set(entry.id, entry);
      byTeams.set(`${normalizeTeamName(entry.homeTeam)}::${normalizeTeamName(entry.awayTeam)}`, entry);
    }

    return { byId, byTeams };
  }

  async savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
    const sheets = await this.getClient();
    const now = new Date().toISOString();
    const gameId = prediction.gameId ?? `${prediction.homeTeam.toUpperCase()}-${prediction.awayTeam.toUpperCase()}`;

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: this.config.predictionsRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            buildPredictionId(),
            participantId,
            gameId,
            prediction.homeGoals,
            prediction.awayGoals,
            "whatsapp",
            now,
            now,
            false,
            "",
          ],
        ],
      },
    });
  }

  async upsertPrediction(participantId: string, prediction: ParsedPrediction): Promise<"created" | "updated"> {
    const sheets = await this.getClient();
    const now = new Date().toISOString();
    const games = await this.loadGamesDirectory();
    const expectedGame = games.byTeams.get(
      `${normalizeTeamName(prediction.homeTeam)}::${normalizeTeamName(prediction.awayTeam)}`,
    );
    const gameId = prediction.gameId ?? expectedGame?.id ?? `${prediction.homeTeam.toUpperCase()}-${prediction.awayTeam.toUpperCase()}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: this.config.predictionsRange,
    });

    const rows = response.data.values ?? [];
    if (rows.length > 1) {
      const header = rows[0].map((h) => String(h).trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);

      const idxParticipantId = col("id_usuario");
      const idxGameId = col("id_jogo");
      const idxHomeGoals = col("gols_casa");
      const idxAwayGoals = col("gols_fora");
      const idxUpdatedAt = col("updated_at");
      const idxIsDeleted = col("is_deleted");

      if (
        idxParticipantId >= 0 &&
        idxGameId >= 0 &&
        idxHomeGoals >= 0 &&
        idxAwayGoals >= 0 &&
        idxUpdatedAt >= 0 &&
        idxIsDeleted >= 0
      ) {
        const dataRows = rows.slice(1);
        const foundIndex = dataRows.findIndex((row) => {
          const isDeleted = normalizeBool(row[idxIsDeleted]);
          return (
            !isDeleted &&
            String(row[idxParticipantId] ?? "").trim() === participantId &&
            String(row[idxGameId] ?? "").trim().toUpperCase() === gameId.toUpperCase()
          );
        });

        if (foundIndex >= 0) {
          const sheetName = parseSheetName(this.config.predictionsRange);
          const sheetRow = foundIndex + 2;
          const updates: Array<{ col: number; value: string | number }> = [
            { col: idxHomeGoals + 1, value: prediction.homeGoals },
            { col: idxAwayGoals + 1, value: prediction.awayGoals },
            { col: idxUpdatedAt + 1, value: now },
          ];

          for (const update of updates) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: this.config.spreadsheetId,
              range: `${sheetName}!${columnToLetter(update.col)}${sheetRow}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [[update.value]] },
            });
          }

          return "updated";
        }
      }
    }

    await this.savePrediction(participantId, { ...prediction, gameId });
    return "created";
  }

  async hasPrediction(participantId: string, homeTeam: string, awayTeam: string): Promise<boolean> {
    const games = await this.loadGamesDirectory();
    const predictions = await this.listPredictions();
    const expectedGame = games.byTeams.get(`${normalizeTeamName(homeTeam)}::${normalizeTeamName(awayTeam)}`);
    const expectedGameId = expectedGame?.id ?? `${homeTeam.toUpperCase()}-${awayTeam.toUpperCase()}`;
    return predictions.some(
      (p) =>
        p.participantId === participantId &&
        !p.isDeleted &&
        (
          p.gameId.toUpperCase() === expectedGameId.toUpperCase() ||
          (normalizeTeamName(p.homeTeam) === normalizeTeamName(homeTeam) &&
            normalizeTeamName(p.awayTeam) === normalizeTeamName(awayTeam))
        ),
    );
  }

  async listPredictions(): Promise<StoredPrediction[]> {
    const sheets = await this.getClient();
    const games = await this.loadGamesDirectory();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: this.config.predictionsRange,
    });

    const rows = response.data.values ?? [];
    if (rows.length <= 1) return [];

    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);

    const idxPredictionId = col("id_palpite");
    const idxParticipantId = col("id_usuario");
    const idxGameId = col("id_jogo");
    const idxHomeGoals = col("gols_casa");
    const idxAwayGoals = col("gols_fora");
    const idxChannel = col("canal");
    const idxCreatedAt = col("created_at");
    const idxUpdatedAt = col("updated_at");
    const idxIsDeleted = col("is_deleted");
    const idxDeletedAt = col("deleted_at");

    const idxLegacyCreatedAt = col("created_at");
    const idxLegacyHomeTeam = col("time_casa");
    const idxLegacyAwayTeam = col("time_fora");
    const idxLegacySource = col("source");

    const dataRows = rows.slice(1);

    return dataRows
      .map((row) => {
        const rowPredictionId = String(row[idxPredictionId] ?? "").trim();
        const rowCreatedAt = String(row[idxCreatedAt] ?? "").trim();
        const rowLegacyHomeTeam = String(row[idxLegacyHomeTeam >= 0 ? idxLegacyHomeTeam : 2] ?? "").trim();
        const rowLegacyAwayTeam = String(row[idxLegacyAwayTeam >= 0 ? idxLegacyAwayTeam : 5] ?? "").trim();
        const looksLegacyRow =
          isIsoDate(rowPredictionId) &&
          !isIsoDate(rowCreatedAt) &&
          !!rowLegacyHomeTeam &&
          !!rowLegacyAwayTeam;

        // Novo formato
        if (idxPredictionId >= 0 && idxGameId >= 0 && !looksLegacyRow) {
          const predictionId = String(row[idxPredictionId] ?? "").trim();
          const participantId = String(row[idxParticipantId] ?? "").trim();
          const gameId = String(row[idxGameId] ?? "").trim();
          const homeGoals = Number(row[idxHomeGoals] ?? NaN);
          const awayGoals = Number(row[idxAwayGoals] ?? NaN);
          if (!predictionId || !participantId || !gameId || Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) return null;

          const gameEntry = games.byId.get(gameId);
          const [fallbackHomeTeam = "UNK", fallbackAwayTeam = "UNK"] = gameId.toUpperCase().split("-");
          const homeTeam = gameEntry?.homeTeam ?? fallbackHomeTeam;
          const awayTeam = gameEntry?.awayTeam ?? fallbackAwayTeam;
          return {
            predictionId,
            participantId,
            gameId,
            homeTeam,
            awayTeam,
            homeGoals,
            awayGoals,
            channel: String(row[idxChannel] ?? "whatsapp") === "streamlit" ? "streamlit" : "whatsapp",
            createdAt: isIsoDate(row[idxCreatedAt]) ? String(row[idxCreatedAt]).trim() : new Date().toISOString(),
            updatedAt: String(row[idxUpdatedAt] ?? "").trim() || new Date().toISOString(),
            isDeleted: normalizeBool(row[idxIsDeleted]),
            deletedAt: String(row[idxDeletedAt] ?? "").trim() || null,
          } satisfies StoredPrediction;
        }

        // Formato legado
        const participantId = String(row[idxParticipantId >= 0 ? idxParticipantId : 1] ?? "").trim();
        const homeTeam = String(row[idxLegacyHomeTeam >= 0 ? idxLegacyHomeTeam : 2] ?? "").trim();
        const awayTeam = String(row[idxLegacyAwayTeam >= 0 ? idxLegacyAwayTeam : 5] ?? "").trim();
        const homeGoals = Number(row[idxHomeGoals >= 0 ? idxHomeGoals : 3] ?? NaN);
        const awayGoals = Number(row[idxAwayGoals >= 0 ? idxAwayGoals : 4] ?? NaN);
        if (!participantId || !homeTeam || !awayTeam || Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) return null;

        const gameId = `${homeTeam.toUpperCase()}-${awayTeam.toUpperCase()}`;
        const legacyCreatedAt = isIsoDate(row[0]) ? String(row[0]).trim() : new Date().toISOString();
        return {
          predictionId: buildLegacyPredictionId(participantId, gameId, legacyCreatedAt),
          participantId,
          gameId,
          homeTeam: homeTeam.toUpperCase(),
          awayTeam: awayTeam.toUpperCase(),
          homeGoals,
          awayGoals,
          channel: String(row[idxLegacySource >= 0 ? idxLegacySource : 6] ?? "whatsapp") === "streamlit" ? "streamlit" : "whatsapp",
          createdAt: legacyCreatedAt,
          updatedAt: legacyCreatedAt,
          isDeleted: false,
          deletedAt: null,
        } satisfies StoredPrediction;
      })
      .filter((item): item is StoredPrediction => item !== null);
  }
}
