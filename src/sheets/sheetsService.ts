import type { ParsedPrediction } from "../domain/prediction.js";

type StoredPrediction = ParsedPrediction & {
  participantId: string;
  source: "whatsapp";
  createdAt: string;
};

const inMemoryPredictions: StoredPrediction[] = [];

export async function savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
  inMemoryPredictions.push({
    ...prediction,
    participantId,
    source: "whatsapp",
    createdAt: new Date().toISOString(),
  });
}

export async function listPredictions(): Promise<StoredPrediction[]> {
  return inMemoryPredictions;
}
