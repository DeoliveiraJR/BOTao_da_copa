import { google } from "googleapis";
import { env } from "../config/env.js";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export type ResolvedParticipant = {
  participantId: string;
  name: string;
  whatsappE164: string;
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

export async function resolveParticipantByWhatsapp(phoneNumber: string): Promise<ResolvedParticipant | null> {
  if (env.PERSISTENCE_PROVIDER !== "google_sheets") {
    return {
      participantId: phoneNumber.replace(/\D/g, "") || "unknown-user",
      name: phoneNumber,
      whatsappE164: normalizeWhatsApp(phoneNumber),
    };
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = required(env.GOOGLE_SHEETS_SPREADSHEET_ID, "GOOGLE_SHEETS_SPREADSHEET_ID");
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Participantes!A:E",
  });

  const rows = response.data.values ?? [];
  const target = normalizeWhatsApp(phoneNumber);
  for (const row of rows.slice(1)) {
    const participantId = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    const whatsappE164 = normalizeWhatsApp(String(row[2] ?? ""));
    const status = String(row[3] ?? "ativo").trim().toLowerCase();
    if (!participantId || !whatsappE164) continue;
    if (status !== "ativo") continue;
    if (whatsappE164 !== target) continue;

    return { participantId, name: name || participantId, whatsappE164 };
  }

  return null;
}
