# BOTao_da_copa

Projeto de bolao da Copa do Mundo FIFA 2026 com operacao principal via WhatsApp, governanca em skills e base compartilhada em Google Sheets.

## Objetivo
Entregar um bolao simples para grupos de WhatsApp, com automacao de palpites, atualizacao de resultados, ranking e mensagens de engajamento.

## Regras oficiais de pontuacao
- Placar exato: +3 pontos
- Vencedor ou empate correto (sem placar exato): +1 ponto
- Demais casos: 0 ponto

## Decisoes de produto (MVP)
- Canal principal: WhatsApp
- Planilha oficial: Google Sheets
- Atualizacao de resultados: hibrida (API + revisao manual)
- Tom de mensagens: sarcasmo moderado, sem ofensa

## Estrutura de skills
As skills do projeto funcionam como base de operacao e governanca. A fonte de verdade de cada fluxo e o respectivo SKILL.md, com checklist separada apenas quando a propria skill declarar esse arquivo de controle.

- regulamento-bolao
	- Regras oficiais, escopo, governanca e obrigacao de checklist viva
- ingestao-resultados
	- Coleta de resultados, reconciliacao API/manual e bloqueio por divergencia
- ranking-bolao
	- Calculo oficial de pontuacao e consolidacao de ranking
- narracao-bolao
	- Mensagens pre-jogo e pos-rodada com guardrails de linguagem

Arquivos considerados oficiais por skill:
- SKILL.md
- CHECKLIST-OPERACIONAL.md quando a skill referenciar esse arquivo explicitamente

## Governanca obrigatoria
- Nenhuma consolidacao oficial deve ocorrer com checklist desatualizada.
- Toda mudanca de regra deve atualizar o SKILL.md correspondente e a checklist quando aplicavel.

## Proximo passo tecnico
1. Validar assinatura do webhook Twilio usando credenciais do provedor.
2. Implementar jobs pre-jogo e pos-rodada.
3. Evoluir do Sandbox para provedor de producao (Twilio Business ou Meta Cloud API).

## Como testar agora
1. Instale dependencias:
	- `npm install`
2. Configure ambiente:
	- copie `.env.example` para `.env`
3. Rode validacoes:
	- `npm test`
	- `npm run typecheck`
	- `npm run build`
4. Suba a API local:
	- `npm run dev`
5. Teste endpoints:
	- `GET /health`
	- `POST /whatsapp/webhook`
	- `GET /predictions`

### Teste via Twilio Sandbox
- Preencha no `.env`:
	- `TWILIO_ACCOUNT_SID`
	- `TWILIO_AUTH_TOKEN`
	- `TWILIO_WHATSAPP_NUMBER=+14155238886`
- Suba a API com `npm run dev`.
- Exponha a porta local com `npx ngrok http 3000`.
- No painel do Twilio Sandbox, configure `When a message comes in` com `https://SEU_DOMINIO_NGROK/twilio/webhook` usando metodo `POST`.
- Envie um palpite para o numero do Sandbox.
- Resultado esperado:
	- resposta no WhatsApp com confirmacao do palpite
	- nova linha na aba `Palpites` da planilha

### Exemplo de teste manual
- Requisicao:
  - `POST /whatsapp/webhook`
  - body JSON: `{"participantId":"user-1","text":"BRA 2x1 ARG"}`
- Resultado esperado:
  - resposta com confirmacao de palpite registrado
  - item visivel em `GET /predictions`

## Persistencia
- `PERSISTENCE_PROVIDER=in_memory`
  - modo default para desenvolvimento local sem credenciais.
- `PERSISTENCE_PROVIDER=google_sheets`
  - habilita escrita/leitura em Google Sheets usando service account.
  - requer configurar:
	 - `GOOGLE_SHEETS_SPREADSHEET_ID`
	 - `GOOGLE_SHEETS_PREDICTIONS_RANGE`
	 - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
	 - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
	- apos configurar, execute:
		- `npm run bootstrap:sheets`
	- esse comando cria/garante as abas oficiais e seus cabecalhos padrao.

### Multibolão (Google Sheets)
- Defina um bolão padrão:
	- `BOLAO_DEFAULT_ID=copa2026`
- Opcional (recomendado): configure metadata completa com nome amigável e planilha por bolão:
	- `BOLAO_CONFIG_JSON={"copa2026":{"name":"Bolão-Zica","spreadsheetId":"ID_PLANILHA_2026"},"bolao_copa_ii":{"name":"Bolão-Trader-Map","spreadsheetId":"ID_PLANILHA_II"}}`
- Defina o mapa `bolaoId -> spreadsheetId`:
	- `BOLAO_SPREADSHEET_MAP={"copa2026":"ID_PLANILHA_2026","bolao_copa_ii":"ID_PLANILHA_II"}`
- Quando `BOLAO_CONFIG_JSON` estiver preenchido, ele tem prioridade sobre `BOLAO_SPREADSHEET_MAP`.
- As rotas aceitam `bolaoId` por query, body ou header `x-bolao-id`.
- Endpoint de suporte:
	- `GET /boloes` retorna os bolões configurados.

### Twilio multibolão (WhatsApp)
- Se um telefone participa de mais de um bolão, o bot solicita seleção por número.
- Para trocar o bolão ativo a qualquer momento, envie:
	- `0`, `bolao` ou `trocar bolao`
- Para manter a sessão ativa entre reinícios da API, configure:
	- `SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- `TWILIO_SESSION_TABLE` (default: `twilio_whatsapp_sessions`)
- Estrutura mínima sugerida na base Supabase para persistir sessão por telefone:
	- `create table if not exists twilio_whatsapp_sessions (phone_number text primary key, bolao_id text not null, participant_id text not null, updated_at timestamptz not null default now());`
- Para enviar a imagem de apresentação do bot no comando `oi`, configure:
	- `BOT_AVATAR_IMAGE_URL` (URL pública HTTPS)

## Status atual
- [x] Skill principal de regulamento implementada
- [x] Skills dependentes criadas com governanca completa
- [x] Backend TypeScript inicial com webhook e parser de palpites
- [x] Regra de pontuacao 3/1/0 com testes de dominio
- [x] Persistencia configuravel (in_memory e Google Sheets para palpites)
- [x] Twilio WhatsApp Sandbox integrado e validado ponta a ponta
- [ ] Jobs automaticos pre/pos-rodada
- [ ] Integracao AGNO em runtime
