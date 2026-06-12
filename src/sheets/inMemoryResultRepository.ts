import type { ResultRepository, StoredResult } from "./types.js";

export class InMemoryResultRepository implements ResultRepository {
  private readonly results: Map<string, StoredResult> = new Map();

  async saveResult(result: Omit<StoredResult, "updatedAt">): Promise<void> {
    this.results.set(result.gameId, {
      ...result,
      updatedAt: new Date().toISOString(),
    });
  }

  async getResult(gameId: string): Promise<StoredResult | null> {
    return this.results.get(gameId) ?? null;
  }

  async listConfirmedResults(): Promise<StoredResult[]> {
    return [...this.results.values()].filter((r) => r.reconciliationStatus === "confirmed");
  }
}
