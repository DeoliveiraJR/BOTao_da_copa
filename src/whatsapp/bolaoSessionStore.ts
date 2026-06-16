import { env } from "../config/env.js";

type BolaoChoiceState = {
  bolaoId: string;
  participantId: string;
  updatedAt: string;
};

type PendingBolaoSelection = {
  participantId: string;
  choices: Array<{
    bolaoId: string;
    bolaoName: string;
  }>;
  originalText: string;
  updatedAt: string;
};

const selectedByPhone = new Map<string, BolaoChoiceState>();
const pendingByPhone = new Map<string, PendingBolaoSelection>();

function normalizePhoneKey(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

function canUseSupabase(): boolean {
  return !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;
}

async function readSelectedFromSupabase(phoneNumber: string): Promise<BolaoChoiceState | null> {
  if (!canUseSupabase()) return null;
  try {
    const phone = normalizePhoneKey(phoneNumber);
    const url = `${env.SUPABASE_URL}/rest/v1/${env.TWILIO_SESSION_TABLE}?phone_number=eq.${phone}&select=bolao_id,participant_id,updated_at&limit=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: String(env.SUPABASE_SERVICE_ROLE_KEY),
        Authorization: `Bearer ${String(env.SUPABASE_SERVICE_ROLE_KEY)}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ bolao_id?: string; participant_id?: string; updated_at?: string }>;
    const row = rows[0];
    if (!row?.bolao_id || !row?.participant_id) return null;
    return {
      bolaoId: String(row.bolao_id),
      participantId: String(row.participant_id),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

async function writeSelectedToSupabase(phoneNumber: string, value: BolaoChoiceState): Promise<void> {
  if (!canUseSupabase()) return;
  try {
    const phone = normalizePhoneKey(phoneNumber);
    const url = `${env.SUPABASE_URL}/rest/v1/${env.TWILIO_SESSION_TABLE}`;
    await fetch(url, {
      method: "POST",
      headers: {
        apikey: String(env.SUPABASE_SERVICE_ROLE_KEY),
        Authorization: `Bearer ${String(env.SUPABASE_SERVICE_ROLE_KEY)}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([
        {
          phone_number: phone,
          bolao_id: value.bolaoId,
          participant_id: value.participantId,
          updated_at: value.updatedAt,
        },
      ]),
    });
  } catch {
    // Silencioso: em caso de falha, mantemos fallback em memória.
  }
}

export async function getSelectedBolaoForPhone(phoneNumber: string): Promise<BolaoChoiceState | null> {
  const key = normalizePhoneKey(phoneNumber);
  const local = selectedByPhone.get(key) ?? null;
  if (local) return local;
  const remote = await readSelectedFromSupabase(phoneNumber);
  if (remote) selectedByPhone.set(key, remote);
  return remote;
}

export async function setSelectedBolaoForPhone(phoneNumber: string, participantId: string, bolaoId: string): Promise<void> {
  const key = normalizePhoneKey(phoneNumber);
  const value = {
    bolaoId,
    participantId,
    updatedAt: new Date().toISOString(),
  };
  selectedByPhone.set(key, value);
  pendingByPhone.delete(key);
  await writeSelectedToSupabase(phoneNumber, value);
}

export function getPendingBolaoSelection(phoneNumber: string): PendingBolaoSelection | null {
  return pendingByPhone.get(normalizePhoneKey(phoneNumber)) ?? null;
}

export function setPendingBolaoSelection(
  phoneNumber: string,
  participantId: string,
  choices: PendingBolaoSelection["choices"],
  originalText: string,
): void {
  pendingByPhone.set(normalizePhoneKey(phoneNumber), {
    participantId,
    choices,
    originalText,
    updatedAt: new Date().toISOString(),
  });
}

export function clearPendingBolaoSelection(phoneNumber: string): void {
  pendingByPhone.delete(normalizePhoneKey(phoneNumber));
}

export async function tryResolveBolaoSelection(
  phoneNumber: string,
  rawText: string,
): Promise<{ bolaoId: string; participantId: string; originalText: string } | null> {
  const pending = getPendingBolaoSelection(phoneNumber);
  if (!pending) return null;

  const text = String(rawText ?? "").trim().toLowerCase();
  const indexMatch = text.match(/^([1-9]\d*)$/) ?? text.match(/^(?:bol[aã]o\s*)?([1-9]\d*)$/);
  if (!indexMatch) return null;

  const index = Number(indexMatch[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= pending.choices.length) return null;

  const choice = pending.choices[index];
  await setSelectedBolaoForPhone(phoneNumber, pending.participantId, choice.bolaoId);
  return { bolaoId: choice.bolaoId, participantId: pending.participantId, originalText: pending.originalText };
}

export function buildBolaoSelectionPrompt(choices: Array<{ bolaoId: string; bolaoName: string }>): string {
  const lines = choices.map((choice, index) => `${index + 1}. ${choice.bolaoName}`);
  return [
    "Seu WhatsApp esta em mais de um bolao.",
    "Responda com o numero do bolao que quer usar agora:",
    "",
    ...lines,
  ].join("\n");
}