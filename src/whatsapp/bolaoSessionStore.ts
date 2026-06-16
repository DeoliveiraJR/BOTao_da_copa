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

export function getSelectedBolaoForPhone(phoneNumber: string): BolaoChoiceState | null {
  return selectedByPhone.get(normalizePhoneKey(phoneNumber)) ?? null;
}

export function setSelectedBolaoForPhone(phoneNumber: string, participantId: string, bolaoId: string): void {
  selectedByPhone.set(normalizePhoneKey(phoneNumber), {
    bolaoId,
    participantId,
    updatedAt: new Date().toISOString(),
  });
  pendingByPhone.delete(normalizePhoneKey(phoneNumber));
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

export function tryResolveBolaoSelection(
  phoneNumber: string,
  rawText: string,
): { bolaoId: string; participantId: string; originalText: string } | null {
  const pending = getPendingBolaoSelection(phoneNumber);
  if (!pending) return null;

  const text = String(rawText ?? "").trim().toLowerCase();
  const indexMatch = text.match(/^([1-9]\d*)$/) ?? text.match(/^(?:bol[aã]o\s*)?([1-9]\d*)$/);
  if (!indexMatch) return null;

  const index = Number(indexMatch[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= pending.choices.length) return null;

  const choice = pending.choices[index];
  setSelectedBolaoForPhone(phoneNumber, pending.participantId, choice.bolaoId);
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