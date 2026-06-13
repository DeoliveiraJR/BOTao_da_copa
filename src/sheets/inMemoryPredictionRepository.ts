import type { ParsedPrediction } from "../domain/prediction.js";
import type { PredictionRepository, StoredPrediction } from "./types.js";

export class InMemoryPredictionRepository implements PredictionRepository {
  private readonly predictions: StoredPrediction[] = [];

  async savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
    const now = new Date().toISOString();
    const gameId = prediction.gameId ?? `${prediction.homeTeam.toUpperCase()}-${prediction.awayTeam.toUpperCase()}`;
    this.predictions.push({
      ...prediction,
      predictionId: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participantId,
      gameId,
      channel: "whatsapp",
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async listPredictions(): Promise<StoredPrediction[]> {
    return [...this.predictions];
  }

  async hasPrediction(participantId: string, homeTeam: string, awayTeam: string): Promise<boolean> {
    return this.predictions.some(
      (p) =>
        p.participantId === participantId &&
        !p.isDeleted &&
        p.homeTeam.toUpperCase() === homeTeam.toUpperCase() &&
        p.awayTeam.toUpperCase() === awayTeam.toUpperCase(),
    );
  }
}
