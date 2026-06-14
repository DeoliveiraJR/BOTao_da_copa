import type { ParsedPrediction } from "../domain/prediction.js";
import type { PredictionRepository, StoredPrediction } from "./types.js";

export class InMemoryPredictionRepository implements PredictionRepository {
  private readonly predictions: StoredPrediction[] = [];

  private resolveGameId(prediction: ParsedPrediction): string {
    return prediction.gameId ?? `${prediction.homeTeam.toUpperCase()}-${prediction.awayTeam.toUpperCase()}`;
  }

  async savePrediction(participantId: string, prediction: ParsedPrediction): Promise<void> {
    const now = new Date().toISOString();
    const gameId = this.resolveGameId(prediction);
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

  async upsertPrediction(participantId: string, prediction: ParsedPrediction): Promise<"created" | "updated"> {
    const gameId = this.resolveGameId(prediction);
    const existing = this.predictions.find(
      (p) => p.participantId === participantId && p.gameId.toUpperCase() === gameId.toUpperCase() && !p.isDeleted,
    );

    if (existing) {
      existing.homeGoals = prediction.homeGoals;
      existing.awayGoals = prediction.awayGoals;
      existing.homeTeam = prediction.homeTeam;
      existing.awayTeam = prediction.awayTeam;
      existing.updatedAt = new Date().toISOString();
      return "updated";
    }

    await this.savePrediction(participantId, { ...prediction, gameId });
    return "created";
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
