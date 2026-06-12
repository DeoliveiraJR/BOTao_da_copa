import { parsePredictionText } from "../domain/prediction.js";
import { savePrediction } from "../sheets/sheetsService.js";

export type IncomingWhatsAppMessage = {
  participantId: string;
  text: string;
};

export async function processWhatsAppMessage(input: IncomingWhatsAppMessage): Promise<string> {
  const parsed = parsePredictionText(input.text);

  if (!parsed) {
    return "Formato invalido. Use: BRA 2x1 ARG";
  }

  await savePrediction(input.participantId, parsed);

  return `Palpite registrado: ${parsed.homeTeam} ${parsed.homeGoals}x${parsed.awayGoals} ${parsed.awayTeam}`;
}
