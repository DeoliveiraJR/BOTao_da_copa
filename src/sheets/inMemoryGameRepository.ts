import type { GameRepository, StoredGame } from "./types.js";

export class InMemoryGameRepository implements GameRepository {
  private readonly games: StoredGame[] = [];

  async listGames(): Promise<StoredGame[]> {
    return [...this.games];
  }

  async listByRound(round: string): Promise<StoredGame[]> {
    return this.games.filter((g) => g.round === round);
  }

  async listUpcoming(limitHours: number): Promise<StoredGame[]> {
    const now = Date.now();
    const limit = limitHours * 60 * 60 * 1000;
    return this.games.filter((g) => {
      const diff = new Date(g.dateTime).getTime() - now;
      return diff > 0 && diff <= limit;
    });
  }

  async findGame(homeTeam: string, awayTeam: string): Promise<StoredGame | null> {
    return (
      this.games.find(
        (g) =>
          g.homeTeam.toUpperCase() === homeTeam.toUpperCase() &&
          g.awayTeam.toUpperCase() === awayTeam.toUpperCase(),
      ) ?? null
    );
  }
}
