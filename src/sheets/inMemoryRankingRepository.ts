import type { RankingEntry, RankingRepository } from "./types.js";

export class InMemoryRankingRepository implements RankingRepository {
  private readonly entries: Map<string, Omit<RankingEntry, "position">> = new Map();

  async upsertEntry(entry: Omit<RankingEntry, "position" | "updatedAt">): Promise<void> {
    this.entries.set(entry.participantId, {
      ...entry,
      updatedAt: new Date().toISOString(),
    });
  }

  async listRanking(): Promise<RankingEntry[]> {
    return [...this.entries.values()]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({ ...entry, position: index + 1 }));
  }
}
