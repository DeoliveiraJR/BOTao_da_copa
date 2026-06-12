import { Router } from "express";
import { env } from "../config/env.js";
import { processWhatsAppMessage } from "./whatsappService.js";

export const whatsappRouter = Router();

whatsappRouter.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden");
});

whatsappRouter.post("/webhook", async (req, res) => {
  const participantId = String(req.body?.participantId ?? "unknown-user");
  const text = String(req.body?.text ?? "");

  const reply = await processWhatsAppMessage({ participantId, text });

  return res.status(200).json({ ok: true, reply });
});
