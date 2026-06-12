import type { ParsedPrediction } from "../domain/prediction.js";

export type StoredPrediction = ParsedPrediction & {
  participantId: string;
  source: "whatsapp";
  createdAt: string;
};

export interface PredictionRepository {
  savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void>;
  listPredictions(): Promise<StoredPrediction[]>;
}
