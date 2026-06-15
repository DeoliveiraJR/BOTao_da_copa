import express from "express";
import { env } from "./config/env.js";
import { listConfiguredBoloes, resolveSpreadsheetIdForBolao } from "./config/bolaoConfig.js";
import { consolidateRanking, getRanking } from "./domain/rankingService.js";
import { createGameRepository, createPredictionRepository, createResultRepository } from "./sheets/predictionRepositoryFactory.js";
import { listPredictions } from "./sheets/sheetsService.js";
import { whatsappRouter } from "./whatsapp/webhookRouter.js";
import { twilioRouter } from "./whatsapp/twilioRouter.js";

const app = express();

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

function asString(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }
  return String(value ?? "").trim();
}

function resolveBolaoId(req: express.Request): string | undefined {
  const queryValue = asString(req.query?.bolaoId);
  const bodyValue = asString((req.body as Record<string, unknown> | undefined)?.bolaoId);
  const headerValue = asString(req.header("x-bolao-id"));
  const value = queryValue || bodyValue || headerValue;
  return value || undefined;
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/health", (req, res) => {
  if (env.PERSISTENCE_PROVIDER !== "google_sheets") {
    return res.status(200).json({ ok: true, service: "botao-da-copa", bolaoId: env.BOLAO_DEFAULT_ID });
  }

  const bolaoId = resolveBolaoId(req);
  const resolved = resolveSpreadsheetIdForBolao(bolaoId);
  return res.status(200).json({ ok: true, service: "botao-da-copa", bolaoId: resolved.bolaoId });
});

app.get("/boloes", (_req, res) => {
  if (env.PERSISTENCE_PROVIDER !== "google_sheets") {
    return res.status(200).json({
      ok: true,
      defaultBolaoId: env.BOLAO_DEFAULT_ID,
      count: 1,
      boloes: [{ id: env.BOLAO_DEFAULT_ID, name: env.BOLAO_DEFAULT_ID }],
    });
  }

  const boloes = listConfiguredBoloes().map((item) => ({ id: item.id, name: item.name }));
  return res.status(200).json({ ok: true, defaultBolaoId: env.BOLAO_DEFAULT_ID, count: boloes.length, boloes });
});

app.get("/predictions", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const predictions = await listPredictions(bolaoId);
  res.status(200).json({ ok: true, bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID, count: predictions.length, predictions });
});

// Body: { participantId: string, gameId: string, homeGoals: number, awayGoals: number }
app.post("/predictions", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const { participantId, gameId, homeGoals, awayGoals } = req.body ?? {};
  if (!participantId || !gameId || homeGoals === undefined || awayGoals === undefined) {
    return res.status(400).json({ ok: false, error: "participantId, gameId, homeGoals e awayGoals são obrigatórios" });
  }

  const gameRepo = createGameRepository(bolaoId);
  const predictionRepo = createPredictionRepository(bolaoId);
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
    bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID,
    action,
    gameId: game.id,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  });
});

app.get("/games", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const gameRepo = createGameRepository(bolaoId);
  const games = await gameRepo.listGames();
  res.status(200).json({ ok: true, bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID, count: games.length, games });
});

app.get("/ranking", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const ranking = await getRanking(bolaoId);
  res.status(200).json({ ok: true, bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID, count: ranking.length, ranking });
});

app.post("/ranking/consolidate", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const result = await consolidateRanking(bolaoId);
  res.status(200).json({ ok: true, bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID, ...result });
});

app.use("/whatsapp", whatsappRouter);
app.use("/twilio", twilioRouter);

app.get("/results", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const resultRepo = createResultRepository(bolaoId);
  const results = await resultRepo.listConfirmedResults();
  res.status(200).json({ ok: true, bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID, count: results.length, results });
});

// Body: { gameId: string, homeGoalsManual: number, awayGoalsManual: number, reconciliationStatus?: "pending"|"confirmed"|"conflict" }
app.post("/results", async (req, res) => {
  const bolaoId = resolveBolaoId(req);
  const resultRepo = createResultRepository(bolaoId);
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
  return res.status(201).json({ ok: true, bolaoId: bolaoId ?? env.BOLAO_DEFAULT_ID, gameId });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Bolão não configurado")) {
    return res.status(400).json({ ok: false, error: message });
  }
  return res.status(500).json({ ok: false, error: message || "Erro interno" });
});

app.listen(env.PORT, () => {
  console.log(`BOTao da Copa API rodando na porta ${env.PORT}`);
});
