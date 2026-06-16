import { google } from "googleapis";
import { listConfiguredBoloes } from "../config/bolaoConfig.js";
import { env } from "../config/env.js";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export type ResolvedParticipant = {
  participantId: string;
  name: string;
  whatsappE164: string;
};

export type ResolvedParticipantBolao = ResolvedParticipant & {
  bolaoId: string;
  bolaoName: string;
};

function normalizeWhatsApp(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: required(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: required(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: GOOGLE_SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

async function loadParticipantsFromSpreadsheet(spreadsheetId: string): Promise<Array<ResolvedParticipant>> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Participantes!A:E",
  });

  const rows = response.data.values ?? [];
  const target = normalizeWhatsApp;
  return rows.slice(1).flatMap((row) => {
    const participantId = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    const whatsappE164 = normalizeWhatsApp(String(row[2] ?? ""));
    const status = String(row[3] ?? "ativo").trim().toLowerCase();
    if (!participantId || !whatsappE164) return [];
    if (status !== "ativo") return [];
    return [{ participantId, name: name || participantId, whatsappE164 }];
  });
}

export async function resolveParticipantsByWhatsapp(phoneNumber: string): Promise<ResolvedParticipantBolao[]> {
  if (env.PERSISTENCE_PROVIDER !== "google_sheets") {
    return [
      {
        participantId: phoneNumber.replace(/\D/g, "") || "unknown-user",
        name: phoneNumber,
        whatsappE164: normalizeWhatsApp(phoneNumber),
        bolaoId: env.BOLAO_DEFAULT_ID,
        bolaoName: env.BOLAO_DEFAULT_ID,
      },
    ];
  }

  const target = normalizeWhatsApp(phoneNumber);
  const boloes = listConfiguredBoloes();
  const memberships = await Promise.all(
    boloes.map(async (bolao) => {
      const participants = await loadParticipantsFromSpreadsheet(bolao.spreadsheetId);
      return participants
        .filter((row) => row.whatsappE164 === target)
        .map((row) => ({
          ...row,
          bolaoId: bolao.id,
          bolaoName: bolao.name,
        }));
    }),
  );

  return memberships.flat();
}

export async function resolveParticipantByWhatsapp(phoneNumber: string): Promise<ResolvedParticipantBolao | null> {
  const memberships = await resolveParticipantsByWhatsapp(phoneNumber);
  return memberships[0] ?? null;
}
