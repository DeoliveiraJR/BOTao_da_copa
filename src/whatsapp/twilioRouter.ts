import { Router } from "express";
import { processWhatsAppMessage } from "./whatsappService.js";
import { resolveParticipantByWhatsapp } from "./participantResolver.js";
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

    const participant = await resolveParticipantByWhatsapp(message.phoneNumber);
    if (!participant) {
      const notRegisteredResponse = formatTwilioResponse(
        "Seu numero nao esta cadastrado neste bolao. Fale com o administrador para vincular seu WhatsApp antes de enviar palpites."
      );
      res.type("application/xml");
      return res.send(notRegisteredResponse);
    }

    // Processa com lógica existente
    const reply = await processWhatsAppMessage({
      participantId: participant.participantId,
      text: message.text,
    });

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
