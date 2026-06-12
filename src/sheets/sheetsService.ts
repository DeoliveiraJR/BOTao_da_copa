import type { ParsedPrediction } from "../domain/prediction.js";
import { createPredictionRepository } from "./predictionRepositoryFactory.js";
import type { StoredPrediction } from "./types.js";

const predictionRepository = createPredictionRepository();

export async function savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
  await predictionRepository.savePrediction(participantId, prediction);
}

export async function listPredictions(): Promise<StoredPrediction[]> {
  return predictionRepository.listPredictions();
}
