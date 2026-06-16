import path from "node:path";
import { google } from "googleapis";
import XLSX from "xlsx";
import { resolveSpreadsheetIdForBolao } from "../config/bolaoConfig.js";
import { env } from "../config/env.js";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

type ParsedResult = {
  gameId: string;
  homeGoalsManual: number | null;
  awayGoalsManual: number | null;
  statusReconciliation: "pending" | "confirmed";
  officialResult: "manual";
  updatedAt: string;
};

type GameLifecycle = "scheduled" | "in_progress" | "finished";

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function parseOptionalInt(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(value: unknown): "ativo" | "inativo" {
  const v = normalizeText(value);
  return ["sim", "yes", "true", "1", "ativo"].includes(v) ? "ativo" : "inativo";
}

function resolveParticipantAlias(name: string): string {
  const n = normalizeText(name);
  if (n === "fabio") return "peregrino";
  return n;
}

function toIsoDateTime(dateValue: unknown, hourValue: unknown): string {
  const date = String(dateValue ?? "").trim();
  const hour = String(hourValue ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date().toISOString();
  }

  if (!hour) {
    return `${date}T23:59:00-03:00`;
  }

  if (!/^\d{1,2}:\d{2}$/.test(hour)) {
    return `${date}T23:59:00-03:00`;
  }

  const [h, m] = hour.split(":");
  const hh = h.padStart(2, "0");
  return `${date}T${hh}:${m}:00-03:00`;
}

function computeGameLifecycle(dateValue: unknown, hourValue: unknown, now: Date): GameLifecycle {
  const iso = toIsoDateTime(dateValue, hourValue);
  const kickoff = new Date(iso);
  if (Number.isNaN(kickoff.getTime())) return "scheduled";

  const diffMs = now.getTime() - kickoff.getTime();
  if (diffMs < 0) return "scheduled";
  if (diffMs < 150 * 60 * 1000) return "in_progress";
  return "finished";
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: required(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: required(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: GOOGLE_SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

async function writeTabRows(sheets: Awaited<ReturnType<typeof getSheetsClient>>, spreadsheetId: string, range: string, rows: (string | number | boolean | null)[][]) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });

  if (rows.length === 0) return;

  const writeRange = range.replace("A2:Z", "A2");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: writeRange,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const replaceParticipants = args.includes("--replace-participants");
  const pathArg = args.find((a) => !a.startsWith("--"));
  const bolaoArg = args.find((a) => a.startsWith("--bolao-id="))?.split("=")[1]?.trim();
  const spreadsheetArg = args.find((a) => a.startsWith("--spreadsheet-id="))?.split("=")[1]?.trim();
  const filePath = path.resolve(process.cwd(), pathArg ?? "../bolao_zica.xlsx");
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const wb = XLSX.readFile(filePath);
  const participantsSheet = wb.Sheets.Participantes;
  const gamesSheet = wb.Sheets.Jogos;
  const predictionsSheet = wb.Sheets.Palpites;
  const resultsSheet = wb.Sheets.Resultados;

  if (!participantsSheet || !gamesSheet || !predictionsSheet || !resultsSheet) {
    throw new Error("Workbook precisa conter as abas: Participantes, Jogos, Palpites e Resultados");
  }

  const participantsRaw = XLSX.utils.sheet_to_json<(string | number)[]>(participantsSheet, { header: 1, defval: "", raw: false });
  const gamesRaw = XLSX.utils.sheet_to_json<(string | number)[]>(gamesSheet, { header: 1, defval: "", raw: false });
  const predictionsRaw = XLSX.utils.sheet_to_json<(string | number)[]>(predictionsSheet, { header: 1, defval: "", raw: false });
  const resultsRaw = XLSX.utils.sheet_to_json<(string | number)[]>(resultsSheet, { header: 1, defval: "", raw: false });

  const participantsRows = participantsRaw.slice(1);
  const gamesRows = gamesRaw.slice(1);
  const predictionsRows = predictionsRaw.slice(1);
  const resultsRows = resultsRaw.slice(1);

  const participants = participantsRows
    .map((row) => {
      const rawId = String(row[0] ?? "").trim();
      const name = String(row[1] ?? "").trim();
      if (!name) return null;
      const participantId = normalizeId(rawId) || normalizeId(name) || `user-${Math.random().toString(36).slice(2, 8)}`;
      return {
        participantId,
        name,
        normalizedName: normalizeText(name),
        status: normalizeStatus(row[2]),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const participantById = new Map(participants.map((p) => [normalizeId(p.participantId), p.participantId]));
  const participantByName = new Map(participants.map((p) => [p.normalizedName, p.participantId]));

  const resultsByGameId = new Map<string, ParsedResult>();
  for (const row of resultsRows) {
    const gameId = String(row[0] ?? "").trim();
    if (!gameId) continue;
    const home = parseOptionalInt(row[7]);
    const away = parseOptionalInt(row[8]);
      const hasScore = home !== null && away !== null;
    resultsByGameId.set(gameId, {
      gameId,
      homeGoalsManual: home,
      awayGoalsManual: away,
      statusReconciliation: hasScore ? "confirmed" : "pending",
      officialResult: "manual",
      updatedAt: now,
    });
  }

  const games = gamesRows
    .map((row) => {
      const gameId = String(row[0] ?? "").trim();
      const homeTeam = String(row[7] ?? "").trim();
      const awayTeam = String(row[8] ?? "").trim();
      if (!gameId || !homeTeam || !awayTeam) return null;

      const result = resultsByGameId.get(gameId);
      const lifecycle = computeGameLifecycle(row[5], row[6], nowDate);
      const canConfirmResult = lifecycle === "finished";
      const hasScore = (result?.homeGoalsManual ?? null) !== null && (result?.awayGoalsManual ?? null) !== null;

      if (result) {
        result.statusReconciliation = canConfirmResult && hasScore ? "confirmed" : "pending";
        if (!canConfirmResult) {
          result.homeGoalsManual = null;
          result.awayGoalsManual = null;
        }
      }

      return {
        gameId,
        phase: String(row[1] ?? "").trim(),
        group: String(row[2] ?? "").trim(),
        dateBrt: String(row[5] ?? "").trim(),
        hourBrt: String(row[6] ?? "").trim(),
        dateTimeIso: toIsoDateTime(row[5], row[6]),
        homeTeam,
        awayTeam,
        status: lifecycle,
        source: "xlsx_import",
        updatedAt: now,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const unknownParticipants = new Set<string>();
  const predictions = predictionsRows
    .map((row, index) => {
      const participantRaw = String(row[0] ?? "").trim();
      const gameId = String(row[1] ?? "").trim();
      const homeGoals = parseOptionalInt(row[8]);
      const awayGoals = parseOptionalInt(row[9]);
      if (!participantRaw || !gameId || homeGoals === null || awayGoals === null) return null;

      const participantId =
        participantById.get(normalizeId(participantRaw)) ??
        participantByName.get(resolveParticipantAlias(participantRaw));

      if (!participantId) {
        unknownParticipants.add(participantRaw);
        return null;
      }

      const createdAt = toIsoDateTime(row[4], row[5]);
      return {
        predictionId: `xlsx-${participantId}-${gameId}-${index + 1}`,
        participantId,
        gameId,
        homeGoals,
        awayGoals,
        channel: "whatsapp",
        createdAt,
        updatedAt: now,
        isDeleted: false,
        deletedAt: "",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const results = Array.from(resultsByGameId.values()).map((r) => [
    r.gameId,
    "",
    "",
    r.homeGoalsManual ?? "",
    r.awayGoalsManual ?? "",
    r.statusReconciliation,
    r.officialResult,
    r.updatedAt,
  ]);

  const participantsValues = participants.map((p) => [p.participantId, p.name, "", p.status, now]);
  const gamesValues = games.map((g) => [
    g.gameId,
    g.phase,
    g.group,
    g.dateBrt,
    g.hourBrt,
    g.dateTimeIso,
    g.homeTeam,
    g.awayTeam,
    g.status,
    g.source,
    g.updatedAt,
  ]);
  const predictionsValues = predictions.map((p) => [
    p.predictionId,
    p.participantId,
    p.gameId,
    p.homeGoals,
    p.awayGoals,
    p.channel,
    p.createdAt,
    p.updatedAt,
    p.isDeleted,
    p.deletedAt,
  ]);

  console.log("Import preview:");
  console.log(`- file: ${filePath}`);
  console.log(`- participantes: ${participantsValues.length}`);
  console.log(`- jogos: ${gamesValues.length}`);
  console.log(`- palpites: ${predictionsValues.length}`);
  console.log(`- resultados: ${results.length}`);

  if (unknownParticipants.size > 0) {
    console.log(`- participantes sem match (ignorados): ${unknownParticipants.size}`);
    console.log(`  ${Array.from(unknownParticipants).slice(0, 20).join(", ")}`);
  }

  if (!apply) {
    console.log("Dry run finalizado. Use --apply para escrever na planilha oficial.");
    return;
  }

  const spreadsheetId = spreadsheetArg || resolveSpreadsheetIdForBolao(bolaoArg).spreadsheetId || required(env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID");
  const sheets = await getSheetsClient();

  if (replaceParticipants) {
    await writeTabRows(sheets, spreadsheetId, "Participantes!A2:Z", participantsValues);
  }
  await writeTabRows(sheets, spreadsheetId, "Jogos!A2:Z", gamesValues);
  await writeTabRows(sheets, spreadsheetId, "Palpites!A2:Z", predictionsValues);
  await writeTabRows(sheets, spreadsheetId, "Resultados!A2:Z", results);
  await writeTabRows(sheets, spreadsheetId, "Pontuacao por Jogo!A2:Z", []);
  await writeTabRows(sheets, spreadsheetId, "Ranking!A2:Z", []);

  if (replaceParticipants) {
    console.log("Importação aplicada com sucesso (Participantes/Jogos/Palpites/Resultados + limpeza de derivados).");
  } else {
    console.log("Importação aplicada com sucesso (Jogos/Palpites/Resultados + limpeza de derivados, Participantes preservado).");
  }
}

main().catch((error) => {
  console.error("Falha na importação da base XLSX:", error);
  process.exit(1);
});
