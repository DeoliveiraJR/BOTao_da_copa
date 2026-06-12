import type { ParsedPrediction } from "../domain/prediction.js";
import type { PredictionRepository, StoredPrediction } from "./types.js";

export class InMemoryPredictionRepository implements PredictionRepository {
  private readonly predictions: StoredPrediction[] = [];

  async savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
    this.predictions.push({
      ...prediction,
      participantId,
      source: "whatsapp",
      createdAt: new Date().toISOString(),
    });
  }

  async listPredictions(): Promise<StoredPrediction[]> {
    return [...this.predictions];
  }

  async hasPrediction(participantId: string, homeTeam: string, awayTeam: string): Promise<boolean> {
    return this.predictions.some(
      (p) =>
        p.participantId === participantId &&
        p.homeTeam.toUpperCase() === homeTeam.toUpperCase() &&
        p.awayTeam.toUpperCase() === awayTeam.toUpperCase(),
    );
  }
}
