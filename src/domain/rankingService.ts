import { calculateBolaoPoints } from "../domain/scoring.js";
import {
  createPredictionRepository,
  createRankingRepository,
  createResultRepository,
} from "../sheets/predictionRepositoryFactory.js";
import type { RankingEntry } from "../sheets/types.js";

const predictionRepo = createPredictionRepository();
const resultRepo = createResultRepository();
const rankingRepo = createRankingRepository();

export type RankingConsolidationResult = {
  processed: number;
  ranking: RankingEntry[];
};

export async function consolidateRanking(): Promise<RankingConsolidationResult> {
  const [predictions, confirmedResults] = await Promise.all([
    predictionRepo.listPredictions(),
    resultRepo.listConfirmedResults(),
  ]);

  // Accumulate points per participant across all confirmed results
  const pointsMap = new Map<string, number>();

  for (const result of confirmedResults) {
    if (result.homeGoalsManual === null || result.awayGoalsManual === null) continue;

    const actual = { home: result.homeGoalsManual, away: result.awayGoalsManual };

    for (const prediction of predictions) {
      const expectedId = prediction.gameId.toUpperCase();
      if (result.gameId.toUpperCase() !== expectedId) continue;
      if (prediction.isDeleted) continue;

      const { points } = calculateBolaoPoints(
        { home: prediction.homeGoals, away: prediction.awayGoals },
        actual,
      );

      pointsMap.set(
        prediction.participantId,
        (pointsMap.get(prediction.participantId) ?? 0) + points,
      );
    }
  }

  // Persist updated totals
  for (const [participantId, totalPoints] of pointsMap.entries()) {
    await rankingRepo.upsertEntry({ participantId, name: participantId, totalPoints });
  }

  const ranking = await rankingRepo.listRanking();
  return { processed: confirmedResults.length, ranking };
}

export async function getRanking(): Promise<RankingEntry[]> {
  return rankingRepo.listRanking();
}
