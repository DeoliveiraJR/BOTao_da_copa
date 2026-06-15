import { google } from "googleapis";
import { resolveSpreadsheetIdForBolao } from "../config/bolaoConfig.js";
import { env } from "../config/env.js";

type SheetDefinition = {
  title: string;
  header: string[];
};

const SHEETS: SheetDefinition[] = [
  { title: "Regulamento", header: ["chave", "valor", "updated_at"] },
  { title: "Participantes", header: ["id_usuario", "nome", "whatsapp_e164", "status", "created_at"] },
  {
    title: "Jogos",
    header: [
      "id_jogo",
      "fase",
      "grupo",
      "data_brt",
      "hora_brt",
      "data_hora_iso",
      "time_casa",
      "time_fora",
      "status",
      "fonte",
      "updated_at",
    ],
  },
  {
    title: "Palpites",
    header: [
      "id_palpite",
      "id_usuario",
      "id_jogo",
      "gols_casa",
      "gols_fora",
      "canal",
      "created_at",
      "updated_at",
      "is_deleted",
      "deleted_at",
    ],
  },
  {
    title: "Resultados",
    header: [
      "id_jogo",
      "gols_casa_api",
      "gols_fora_api",
      "gols_casa_manual",
      "gols_fora_manual",
      "status_reconciliacao",
      "resultado_oficial",
      "updated_at",
    ],
  },
  {
    title: "Pontuacao por Jogo",
    header: ["id_jogo", "id_usuario", "pontos", "motivo", "updated_at"],
  },
  {
    title: "Ranking",
    header: ["posicao", "id_usuario", "nome", "pontos_total", "updated_at"],
  },
  {
    title: "Rodadas-Resumo",
    header: ["rodada", "resumo", "destaques", "published_at"],
  },
  {
    title: "Config",
    header: ["chave", "valor", "updated_at"],
  },
];

function getRequired(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: getRequired(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: getRequired(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
      /\\n/g,
      "\n",
    ),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const bolaoId = args.find((a) => a.startsWith("--bolao-id="))?.split("=")[1]?.trim();
  const spreadsheetId = args.find((a) => a.startsWith("--spreadsheet-id="))?.split("=")[1]?.trim();
  return { bolaoId, spreadsheetId };
}

async function ensureSheetStructure() {
  const { bolaoId, spreadsheetId: spreadsheetArg } = parseCliArgs();
  const spreadsheetId =
    spreadsheetArg || resolveSpreadsheetIdForBolao(bolaoId).spreadsheetId || getRequired(env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID");
  const sheets = await getSheetsClient();

  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean));

  const missing = SHEETS.filter((sheet) => !existingTitles.has(sheet.title));

  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((sheet) => ({
          addSheet: {
            properties: { title: sheet.title },
          },
        })),
      },
    });
  }

  for (const sheet of SHEETS) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheet.title}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [sheet.header],
      },
    });
  }

  console.log("Google Sheets inicializado com sucesso.");
}

ensureSheetStructure().catch((error) => {
  console.error("Falha ao inicializar estrutura da planilha:", error);
  process.exit(1);
});
