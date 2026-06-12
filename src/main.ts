import express from "express";
import { env } from "./config/env.js";
import { consolidateRanking, getRanking } from "./domain/rankingService.js";
import { listPredictions } from "./sheets/sheetsService.js";
import { whatsappRouter } from "./whatsapp/webhookRouter.js";

const app = express();

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

app.listen(env.PORT, () => {
  console.log(`BOTao da Copa API rodando na porta ${env.PORT}`);
});
