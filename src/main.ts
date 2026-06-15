import express from "express";
import { env } from "./config/env.js";
import { consolidateRanking, getRanking } from "./domain/rankingService.js";
import { createGameRepository, createPredictionRepository, createResultRepository } from "./sheets/predictionRepositoryFactory.js";
import { listPredictions } from "./sheets/sheetsService.js";
import { whatsappRouter } from "./whatsapp/webhookRouter.js";
import { twilioRouter } from "./whatsapp/twilioRouter.js";

const app = express();
const resultRepo = createResultRepository();
const gameRepo = createGameRepository();
const predictionRepo = createPredictionRepository();

function toSaoPauloDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNextSaoPauloDateKey(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const valueOf = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const year = valueOf("year");
  const month = valueOf("month");
  const day = valueOf("day");
  const nextUtc = new Date(Date.UTC(year, month - 1, day + 1));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextUtc);
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "botao-da-copa" });
});

app.get("/predictions", async (_req, res) => {
  const predictions = await listPredictions();
  res.status(200).json({ ok: true, count: predictions.length, predictions });
});

// Body: { participantId: string, gameId: string, homeGoals: number, awayGoals: number }
app.post("/predictions", async (req, res) => {
  const { participantId, gameId, homeGoals, awayGoals } = req.body ?? {};
  if (!participantId || !gameId || homeGoals === undefined || awayGoals === undefined) {
    return res.status(400).json({ ok: false, error: "participantId, gameId, homeGoals e awayGoals são obrigatórios" });
  }

  const games = await gameRepo.listGames();
  const game = games.find((g) => String(g.id) === String(gameId));
  if (!game) {
    return res.status(404).json({ ok: false, error: "Jogo não encontrado" });
  }

  if (game.status === "in_progress" || game.status === "finished") {
    return res.status(400).json({ ok: false, error: "Janela de palpite encerrada para este jogo" });
  }

  const gameDateKey = toSaoPauloDateKey(new Date(game.dateTime));
  const nextDateKey = getNextSaoPauloDateKey();
  if (gameDateKey !== nextDateKey) {
    return res.status(400).json({ ok: false, error: "Hoje só é permitido palpitar jogos do próximo dia" });
  }

  const action = await predictionRepo.upsertPrediction(String(participantId), {
    gameId: String(game.id),
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeGoals: Number(homeGoals),
    awayGoals: Number(awayGoals),
  });

  return res.status(201).json({
    ok: true,
    action,
    gameId: game.id,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  });
});

app.get("/games", async (_req, res) => {
  const games = await gameRepo.listGames();
  res.status(200).json({ ok: true, count: games.length, games });
});

app.get("/ranking", async (_req, res) => {
  const ranking = await getRanking();
  res.status(200).json({ ok: true, count: ranking.length, ranking });
});

app.post("/ranking/consolidate", async (_req, res) => {
  const result = await consolidateRanking();
  res.status(200).json({ ok: true, ...result });
});

app.use("/whatsapp", whatsappRouter);
app.use("/twilio", twilioRouter);

app.get("/results", async (_req, res) => {
  const results = await resultRepo.listConfirmedResults();
  res.status(200).json({ ok: true, count: results.length, results });
});

// Body: { gameId: string, homeGoalsManual: number, awayGoalsManual: number, reconciliationStatus?: "pending"|"confirmed"|"conflict" }
app.post("/results", async (req, res) => {
  const { gameId, homeGoalsManual, awayGoalsManual, reconciliationStatus = "confirmed" } = req.body ?? {};
  if (!gameId || homeGoalsManual === undefined || awayGoalsManual === undefined) {
    return res.status(400).json({ ok: false, error: "gameId, homeGoalsManual e awayGoalsManual são obrigatórios" });
  }
  await resultRepo.saveResult({
    gameId: String(gameId),
    homeGoalsApi: null,
    awayGoalsApi: null,
    homeGoalsManual: Number(homeGoalsManual),
    awayGoalsManual: Number(awayGoalsManual),
    reconciliationStatus,
    officialResult: "manual",
  });
  return res.status(201).json({ ok: true, gameId });
});

app.listen(env.PORT, () => {
  console.log(`BOTao da Copa API rodando na porta ${env.PORT}`);
});
