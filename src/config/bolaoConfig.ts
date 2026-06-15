import { env } from "./env.js";

export type ConfiguredBolao = {
  id: string;
  name: string;
  spreadsheetId: string;
};

type SpreadsheetMap = Record<string, string>;

let cache: SpreadsheetMap | null = null;

function parseMapFromEnv(): SpreadsheetMap {
  if (cache) return cache;
  const raw = env.BOLAO_SPREADSHEET_MAP?.trim();
  if (!raw) {
    cache = {};
    return cache;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("BOLAO_SPREADSHEET_MAP precisa ser um JSON objeto { bolaoId: spreadsheetId }");
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([id, sheet]) => [String(id).trim(), String(sheet ?? "").trim()] as const)
      .filter(([id, sheet]) => !!id && !!sheet);

    cache = Object.fromEntries(entries);
    return cache;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao ler BOLAO_SPREADSHEET_MAP: ${msg}`);
  }
}

function titleizeId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function listConfiguredBoloes(): ConfiguredBolao[] {
  const map = parseMapFromEnv();
  const entries = Object.entries(map).map(([id, spreadsheetId]) => ({
    id,
    name: titleizeId(id),
    spreadsheetId,
  }));

  if (entries.length > 0) {
    return entries;
  }

  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return [];
  }

  return [
    {
      id: env.BOLAO_DEFAULT_ID,
      name: titleizeId(env.BOLAO_DEFAULT_ID),
      spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    },
  ];
}

export function resolveSpreadsheetIdForBolao(bolaoId?: string): { bolaoId: string; spreadsheetId: string } {
  const requested = String(bolaoId ?? "").trim();
  const configured = listConfiguredBoloes();
  const byId = new Map(configured.map((item) => [item.id, item.spreadsheetId]));

  if (requested) {
    const spreadsheetId = byId.get(requested);
    if (!spreadsheetId) {
      throw new Error(`Bolão não configurado: ${requested}`);
    }
    return { bolaoId: requested, spreadsheetId };
  }

  const defaultFromMap = byId.get(env.BOLAO_DEFAULT_ID);
  if (defaultFromMap) {
    return { bolaoId: env.BOLAO_DEFAULT_ID, spreadsheetId: defaultFromMap };
  }

  if (env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return { bolaoId: env.BOLAO_DEFAULT_ID, spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID };
  }

  if (configured.length > 0) {
    const first = configured[0];
    return { bolaoId: first.id, spreadsheetId: first.spreadsheetId };
  }

  throw new Error("Nenhuma planilha configurada para operação de bolão");
}
