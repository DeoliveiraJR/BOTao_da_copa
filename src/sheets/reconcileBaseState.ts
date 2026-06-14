import { google } from "googleapis";
import { env } from "../config/env.js";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

type GameStatus = "scheduled" | "in_progress" | "finished";

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function toIsoDateTime(dateBr: unknown, hourBr: unknown): string | null {
  const date = String(dateBr ?? "").trim();
  const hour = String(hourBr ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  if (!hour) {
    return `${date}T23:59:00-03:00`;
  }

  if (!/^\d{1,2}:\d{2}$/.test(hour)) {
    return `${date}T23:59:00-03:00`;
  }

  const [h, m] = hour.split(":");
  return `${date}T${h.padStart(2, "0")}:${m}:00-03:00`;
}

function computeStatus(kickoffIso: string, now: Date): GameStatus {
  const kickoff = new Date(kickoffIso);
  if (Number.isNaN(kickoff.getTime())) return "scheduled";
  const diffMs = now.getTime() - kickoff.getTime();
  if (diffMs < 0) return "scheduled";
  if (diffMs < 150 * 60 * 1000) return "in_progress";
  return "finished";
}

function normalizeWhatsappE164(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: required(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: required(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: GOOGLE_SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

async function main() {
  const spreadsheetId = required(env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID");
  const now = new Date();
  const nowIso = now.toISOString();
  const sheets = await getSheetsClient();

  const [gamesResp, resultsResp, participantsResp] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Jogos!A:K" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Resultados!A:H" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Participantes!A:E" }),
  ]);

  const gameRows = gamesResp.data.values ?? [];
  const resultRows = resultsResp.data.values ?? [];
  const participantRows = participantsResp.data.values ?? [];

  if (gameRows.length <= 1 || resultRows.length <= 1) {
    throw new Error("Abas Jogos/Resultados sem dados suficientes para reconciliar.");
  }

  const gameById = new Map<string, { status: GameStatus }>();

  const reconciledGames = gameRows.slice(1).map((row) => {
    const gameId = String(row[0] ?? "").trim();
    const fromDateHour = toIsoDateTime(row[3], row[4]);
    const currentIso = String(row[5] ?? "").trim();
    const kickoffIso = fromDateHour ?? (currentIso || nowIso);
    const status = computeStatus(kickoffIso, now);
    if (gameId) gameById.set(gameId, { status });

    return [
      gameId,
      String(row[1] ?? "").trim(),
      String(row[2] ?? "").trim(),
      String(row[3] ?? "").trim(),
      String(row[4] ?? "").trim(),
      kickoffIso,
      String(row[6] ?? "").trim(),
      String(row[7] ?? "").trim(),
      status,
      String(row[9] ?? "xlsx_import").trim() || "xlsx_import",
      nowIso,
    ];
  });

  const reconciledResults = resultRows.slice(1).map((row) => {
    const gameId = String(row[0] ?? "").trim();
    const gameStatus = gameById.get(gameId)?.status ?? "scheduled";

    let homeApi = parseNumber(row[1]);
    let awayApi = parseNumber(row[2]);
    let homeManual = parseNumber(row[3]);
    let awayManual = parseNumber(row[4]);

    if (gameStatus !== "finished") {
      homeApi = null;
      awayApi = null;
      homeManual = null;
      awayManual = null;
    }

    const hasOfficialScore = homeManual !== null && awayManual !== null;
    const statusReconciliation = hasOfficialScore && gameStatus === "finished" ? "confirmed" : "pending";

    return [
      gameId,
      homeApi ?? "",
      awayApi ?? "",
      homeManual ?? "",
      awayManual ?? "",
      statusReconciliation,
      "manual",
      nowIso,
    ];
  });

  const normalizedParticipants = participantRows.slice(1).map((row) => {
    const whatsapp = normalizeWhatsappE164(row[2]);
    return [
      String(row[0] ?? "").trim(),
      String(row[1] ?? "").trim(),
      whatsapp,
      String(row[3] ?? "ativo").trim() || "ativo",
      String(row[4] ?? "").trim() || nowIso,
    ];
  });

  await Promise.all([
    sheets.spreadsheets.values.clear({ spreadsheetId, range: "Jogos!A2:K" }),
    sheets.spreadsheets.values.clear({ spreadsheetId, range: "Resultados!A2:H" }),
    sheets.spreadsheets.values.clear({ spreadsheetId, range: "Participantes!A2:E" }),
    sheets.spreadsheets.values.clear({ spreadsheetId, range: "Pontuacao por Jogo!A2:E" }),
    sheets.spreadsheets.values.clear({ spreadsheetId, range: "Ranking!A2:E" }),
  ]);

  await Promise.all([
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Jogos!A2",
      valueInputOption: "RAW",
      requestBody: { values: reconciledGames },
    }),
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Resultados!A2",
      valueInputOption: "RAW",
      requestBody: { values: reconciledResults },
    }),
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Participantes!A2",
      valueInputOption: "RAW",
      requestBody: { values: normalizedParticipants },
    }),
  ]);

  console.log("Reconciliacao aplicada:");
  console.log(`- jogos atualizados: ${reconciledGames.length}`);
  console.log(`- resultados atualizados: ${reconciledResults.length}`);
  console.log(`- participantes normalizados: ${normalizedParticipants.length}`);
}

main().catch((error) => {
  console.error("Falha ao reconciliar base:", error);
  process.exit(1);
});
