import express from "express";
import { env } from "./config/env.js";
import { consolidateRanking, getRanking } from "./domain/rankingService.js";
import { createResultRepository } from "./sheets/predictionRepositoryFactory.js";
import { listPredictions } from "./sheets/sheetsService.js";
import { whatsappRouter } from "./whatsapp/webhookRouter.js";

const app = express();
const resultRepo = createResultRepository();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "botao-da-copa" });
});

app.get("/predictions", async (_req, res) => {
  const predictions = await listPredictions();
  res.status(200).json({ ok: true, count: predictions.length, predictions });
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
  });
  return res.status(201).json({ ok: true, gameId });
});

app.listen(env.PORT, () => {
  console.log(`BOTao da Copa API rodando na porta ${env.PORT}`);
});
