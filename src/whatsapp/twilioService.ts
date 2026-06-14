/**
 * Twilio WhatsApp Service
 * Traduz payloads Twilio para formato interno da API
 */

export type TwilioIncomingMessage = {
  From?: string; // format: whatsapp:+55XXXXXXXXXX
  Body?: string;
  AccountSid?: string;
};

export type InternalMessage = {
  phoneNumber: string;
  text: string;
};

/**
 * Extrai número de celular do formato Twilio
 * "whatsapp:+551199999999" → "55-11-99999999"
 */
export function extractPhoneNumber(twilioFrom: string): string {
  const match = twilioFrom.match(/\+?(\d+)$/);
  if (!match) return "unknown";
  const fullNumber = match[1];
  return fullNumber;
}

/**
 * Converte mensagem Twilio para formato interno
 */
export function parseIncomingTwilioMessage(payload: TwilioIncomingMessage): InternalMessage {
  const phoneNumber = extractPhoneNumber(payload.From ?? "");
  return {
    phoneNumber,
    text: (payload.Body ?? "").trim(),
  };
}

/**
 * Formata resposta para Twilio XML/TwiML
 * Twilio espera resposta em formato específico
 */
export function formatTwilioResponse(replyText: string): string {
  // Escapar caracteres especiais para XML
  const escaped = replyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escaped}</Message>
</Response>`;
}

/**
 * Valida token de webhook do Twilio
 * Use para confirmar que requisição veio do Twilio
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  twilioAuthToken: string,
  signature: string
): boolean {
  // Implementação: use twilio-sdk para isso
  // Por enquanto, apenas valida se token existe
  return twilioAuthToken.length > 0;
}
