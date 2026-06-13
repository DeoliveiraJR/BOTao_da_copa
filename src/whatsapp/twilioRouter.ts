import { Router } from "express";
import { processWhatsAppMessage } from "./whatsappService.js";
import { formatTwilioResponse, parseIncomingTwilioMessage } from "./twilioService.js";

export const twilioRouter = Router();

/**
 * POST /twilio/webhook
 * Endpoint que Twilio chama quando recebe mensagem no Sandbox
 * Body: { From: "whatsapp:+55...", Body: "texto da mensagem" }
 */
twilioRouter.post("/webhook", async (req, res) => {
  try {
    const twilioPayload = req.body ?? {};
    if (typeof twilioPayload.From !== "string" || typeof twilioPayload.Body !== "string") {
      const invalidPayloadResponse = formatTwilioResponse(
        "Payload invalido recebido. Verifique o webhook do Twilio e tente novamente."
      );
      res.type("application/xml");
      return res.send(invalidPayloadResponse);
    }

    // Parse da mensagem
    const message = parseIncomingTwilioMessage(twilioPayload);

    // Processa com lógica existente
    const reply = await processWhatsAppMessage(message);

    // Formata resposta em XML TwiML para Twilio
    const twiml = formatTwilioResponse(reply);

    res.type("application/xml");
    return res.send(twiml);
  } catch (error) {
    console.error("Erro no webhook Twilio:", error);
    const errorResponse = formatTwilioResponse("Desculpe, ocorreu um erro. Tente novamente.");
    res.type("application/xml");
    return res.send(errorResponse);
  }
});

/**
 * GET /twilio/webhook (Twilio verifica URL)
 * Twilio faz um GET para confirmar que a URL está respondendo
 * Se responder com 200, Twilio ativa o webhook
 */
twilioRouter.get("/webhook", (_req, res) => {
  res.status(200).send("ok");
});
