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
1. Criar backend TypeScript para webhook de WhatsApp.
2. Integrar leitura/escrita do Google Sheets.
3. Implementar fluxo ponta a ponta:
	 - receber palpite
	 - validar prazo e formato
	 - salvar
	 - consolidar ranking apos resultado reconciliado

## Status atual
- [x] Skill principal de regulamento implementada
- [x] Skills dependentes criadas com governanca completa
- [ ] Backend de execucao (webhook + jobs) ainda nao iniciado
