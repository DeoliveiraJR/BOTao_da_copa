import { Router } from "express";
import { processWhatsAppMessage } from "./whatsappService.js";
import { resolveParticipantsByWhatsapp } from "./participantResolver.js";
import {
  buildBolaoSelectionPrompt,
  getPendingBolaoSelection,
  getSelectedBolaoForPhone,
  setPendingBolaoSelection,
  tryResolveBolaoSelection,
} from "./bolaoSessionStore.js";
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

    const memberships = await resolveParticipantsByWhatsapp(message.phoneNumber);
    if (memberships.length === 0) {
      const notRegisteredResponse = formatTwilioResponse(
        "Seu numero nao esta cadastrado em nenhum bolao ativo. Fale com o administrador para vincular seu WhatsApp antes de enviar palpites."
      );
      res.type("application/xml");
      return res.send(notRegisteredResponse);
    }

    let bolaoId: string | undefined;
    let participantId = memberships[0].participantId;
    let pendingOriginalText: string | undefined;

    const selectionResult = tryResolveBolaoSelection(message.phoneNumber, message.text);
    if (selectionResult) {
      bolaoId = selectionResult.bolaoId;
      participantId = selectionResult.participantId;
      pendingOriginalText = selectionResult.originalText;
    } else {
      const selected = getSelectedBolaoForPhone(message.phoneNumber);
      const currentSelection = selected ? memberships.find((item) => item.bolaoId === selected.bolaoId) : null;

      if (currentSelection) {
        bolaoId = currentSelection.bolaoId;
        participantId = currentSelection.participantId;
      } else if (memberships.length === 1) {
        const only = memberships[0];
        bolaoId = only.bolaoId;
        participantId = only.participantId;
      } else {
        const pending = getPendingBolaoSelection(message.phoneNumber);
        if (!pending) {
          setPendingBolaoSelection(
            message.phoneNumber,
            memberships[0].participantId,
            memberships.map((item) => ({ bolaoId: item.bolaoId, bolaoName: item.bolaoName })),
            message.text,
          );

          const selectionResponse = formatTwilioResponse(buildBolaoSelectionPrompt(memberships.map((item) => ({
            bolaoId: item.bolaoId,
            bolaoName: item.bolaoName,
          }))));

          res.type("application/xml");
          return res.send(selectionResponse);
        }

        const waitingResponse = formatTwilioResponse(buildBolaoSelectionPrompt(pending.choices));
        res.type("application/xml");
        return res.send(waitingResponse);
      }
    }

    const payloadText = pendingOriginalText ?? message.text;

    // Processa com lógica existente
    const reply = await processWhatsAppMessage({
      participantId,
      text: payloadText,
      bolaoId,
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
