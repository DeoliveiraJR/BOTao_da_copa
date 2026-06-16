---
name: bot-twilio-whatsapp
description: "Use when: operar, manter ou evoluir o bot WhatsApp via Twilio no BOTao da Copa; tratar intents, multibolão, seleção de bolão, sessão por telefone, mensagens de menu e resposta TwiML com mídia."
version: 1.0.0
owner: BOTaoDaCopa
lastUpdated: 2026-06-16
---

# Skill: BOT Twilio WhatsApp

## Missão
Padronizar o fluxo de mensagens do bot no WhatsApp com Twilio, cobrindo validação de participante, multibolão, seleção/troca de bolão, intents, resposta em TwiML e comportamento esperado em produção.

## Quando usar
Use esta skill quando a tarefa envolver:
- webhook `/twilio/webhook`
- parser de payload Twilio (`From`, `Body`)
- mensagens do bot e copy de comandos
- seleção de bolão por telefone
- sessão ativa por bolão
- resposta com mídia no WhatsApp

## Arquivos principais
- `src/whatsapp/twilioRouter.ts`
- `src/whatsapp/twilioService.ts`
- `src/whatsapp/whatsappService.ts`
- `src/whatsapp/participantResolver.ts`
- `src/whatsapp/bolaoSessionStore.ts`

## Fluxo oficial (inbound)
1. Twilio envia POST `application/x-www-form-urlencoded` em `/twilio/webhook`.
2. `twilioRouter` valida payload mínimo (`From`, `Body`) e faz parse da mensagem.
3. `participantResolver` busca memberships do telefone em todos os bolões.
4. Se nenhum membership: responder bloqueio orientando cadastro.
5. Se múltiplos bolões:
   - Se usuário pediu troca (`0`, `bolao`, `trocar bolao`): abrir seleção.
   - Se houver seleção pendente: aceitar número e resolver bolão.
   - Se não houver seleção pendente: abrir seleção e aguardar número.
6. Com `participantId` + `bolaoId`, encaminhar para `processWhatsAppMessage`.
7. `twilioService` formata TwiML com `<Body>` e opcional `<Media>`.

## Comandos oficiais do usuário
- `1` ou `ranking`: classificação
- `2` ou `jogos`: jogos liberados para palpite
- `3` ou `resumo`: resumo da rodada
- `4` ou `painel`: URL do Streamlit
- `5` ou `ajuda`: menu completo
- `6` ou `oi`: apresentação do bot
- `0` ou `trocar bolao` ou `bolao`: seleção de bolão
- `sugestao`: pitaco rápido
- Palpite: `TIME A NxM TIME B`
- Correção: `alterar TIME A NxM TIME B`

## Sessão de bolão por telefone
- Fonte preferida: Supabase REST (persistente entre reinícios)
- Fallback: memória local em runtime
- Chave: telefone normalizado (apenas dígitos)

Variáveis:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_SESSION_TABLE` (default `twilio_whatsapp_sessions`)

## Mensagem de apresentação com imagem
- O comando `oi` pode incluir mídia no TwiML.
- Variável: `BOT_AVATAR_IMAGE_URL`
- Requisito: URL pública HTTPS válida.

## Guardrails de copy
- Tom: profissional, direto, com leve personalidade.
- Evitar agressividade, ironia pesada e ambiguidades de regra.
- Sempre instruir formato correto quando houver erro de entrada.

## Observação operacional Twilio
- Mensagens de sessão (janela de 24h) podem ser respondidas livremente pelo webhook.
- Mensagens business-initiated fora da janela exigem template aprovado da Meta/Twilio.

## Checklist rápida de mudança
1. Rodar `npm run typecheck`.
2. Rodar `npm test`.
3. Testar manualmente no Sandbox:
   - usuário não cadastrado
   - usuário com 1 bolão
   - usuário com 2+ bolões
   - troca de bolão por comando `0`
   - `oi` com e sem `BOT_AVATAR_IMAGE_URL`
