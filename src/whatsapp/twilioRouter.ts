import { Router } from "express";
import { detectIntent, processWhatsAppMessage } from "./whatsappService.js";
import { env } from "../config/env.js";
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

const SWITCH_BOLAO_PATTERN = /^(trocar\s*bolao|mudar\s*bolao|menu\s*bolao|bolao|0)$/i;

function hasSameChoices(
  pendingChoices: Array<{ bolaoId: string; bolaoName: string }>,
  currentChoices: Array<{ bolaoId: string; bolaoName: string }>,
): boolean {
  if (pendingChoices.length !== currentChoices.length) return false;
  const pendingIds = new Set(pendingChoices.map((item) => item.bolaoId));
  const currentIds = new Set(currentChoices.map((item) => item.bolaoId));
  if (pendingIds.size !== currentIds.size) return false;
  for (const id of pendingIds) {
    if (!currentIds.has(id)) return false;
  }
  return true;
}

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

    const selectionResult = await tryResolveBolaoSelection(message.phoneNumber, message.text);
    if (selectionResult) {
      bolaoId = selectionResult.bolaoId;
      participantId = selectionResult.participantId;
      pendingOriginalText = selectionResult.originalText;
    } else {
      const selected = await getSelectedBolaoForPhone(message.phoneNumber);
      const currentSelection = selected ? memberships.find((item) => item.bolaoId === selected.bolaoId) : null;

      const wantsSwitch = SWITCH_BOLAO_PATTERN.test(message.text);

      if (wantsSwitch && memberships.length > 1) {
        setPendingBolaoSelection(
          message.phoneNumber,
          memberships[0].participantId,
          memberships.map((item) => ({ bolaoId: item.bolaoId, bolaoName: item.bolaoName })),
          "oi",
        );
        const switchingPrompt = formatTwilioResponse(
          [
            "🔁 Vamos trocar o bolão ativo.",
            "",
            buildBolaoSelectionPrompt(memberships.map((item) => ({ bolaoId: item.bolaoId, bolaoName: item.bolaoName }))),
          ].join("\n"),
        );
        res.type("application/xml");
        return res.send(switchingPrompt);
      }

      if (currentSelection) {
        bolaoId = currentSelection.bolaoId;
        participantId = currentSelection.participantId;
      } else if (memberships.length === 1) {
        const only = memberships[0];
        bolaoId = only.bolaoId;
        participantId = only.participantId;
      } else {
        const currentChoices = memberships.map((item) => ({ bolaoId: item.bolaoId, bolaoName: item.bolaoName }));
        const pending = getPendingBolaoSelection(message.phoneNumber);
        const shouldRefreshPending = !pending || !hasSameChoices(pending.choices, currentChoices);

        if (shouldRefreshPending) {
          setPendingBolaoSelection(
            message.phoneNumber,
            memberships[0].participantId,
            currentChoices,
            message.text,
          );

          const selectionResponse = formatTwilioResponse(buildBolaoSelectionPrompt(currentChoices));

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

    const responseIntent = detectIntent(payloadText);
    const mediaUrl = responseIntent === "oi" ? env.BOT_AVATAR_IMAGE_URL : undefined;

    // Formata resposta em XML TwiML para Twilio
    const twiml = formatTwilioResponse(reply, mediaUrl);

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
