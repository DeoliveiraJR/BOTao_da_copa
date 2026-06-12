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
As skills ficam em .github/skills e funcionam como base de operacao e governanca do projeto.

- regulamento-bolao
	- Regras oficiais, escopo, governanca e obrigacao de checklist viva
- ingestao-resultados
	- Coleta de resultados, reconciliacao API/manual e bloqueio por divergencia
- ranking-bolao
	- Calculo oficial de pontuacao e consolidacao de ranking
- narracao-bolao
	- Mensagens pre-jogo e pos-rodada com guardrails de linguagem

Cada skill possui:
- SKILL.md
- CHECKLIST-OPERACIONAL.md
- CHANGELOG.md

## Governanca obrigatoria
- Nenhuma consolidacao oficial deve ocorrer com checklist desatualizada.
- Toda mudanca de regra deve atualizar SKILL.md e CHANGELOG.md correspondentes.

## Proximo passo tecnico
1. Integrar Google Sheets real em todas as entidades (palpites, resultados e ranking).
2. Implementar jobs pre-jogo e pos-rodada.
3. Conectar WhatsApp provider real (Twilio/Meta Cloud API).

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

## Status atual
- [x] Skill principal de regulamento implementada
- [x] Skills dependentes criadas com governanca completa
- [x] Backend TypeScript inicial com webhook e parser de palpites
- [x] Regra de pontuacao 3/1/0 com testes de dominio
- [x] Persistencia configuravel (in_memory e Google Sheets para palpites)
- [ ] Jobs automaticos pre/pos-rodada
- [ ] Integracao AGNO em runtime
