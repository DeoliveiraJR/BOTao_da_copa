import type { ParsedPrediction } from "../domain/prediction.js";
import { createPredictionRepository } from "./predictionRepositoryFactory.js";
import type { StoredPrediction } from "./types.js";

export async function savePrediction(participantId: string, prediction: ParsedPrediction, bolaoId?: string): Promise<void> {
  const predictionRepository = createPredictionRepository(bolaoId);
  await predictionRepository.savePrediction(participantId, prediction);
}

export async function listPredictions(bolaoId?: string): Promise<StoredPrediction[]> {
  const predictionRepository = createPredictionRepository(bolaoId);
  return predictionRepository.listPredictions();
}
