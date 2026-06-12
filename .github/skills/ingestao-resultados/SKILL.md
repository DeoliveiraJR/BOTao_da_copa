---
name: ingestao-resultados
description: Skill para coletar resultados de jogos da Copa 2026, reconciliar API com revisao manual e liberar consolidacao segura do bolao.
version: 1.0.0
owner: BOTaoDaCopa
lastUpdated: 2026-06-11
---

# Skill: Ingestao de Resultados

## Missao
Garantir que cada jogo tenha resultado confiavel, auditavel e pronto para calculo de pontuacao.

## Escopo
- Coletar resultados por API esportiva.
- Permitir revisao manual na planilha Google Sheets.
- Detectar divergencias entre fonte automatica e revisao humana.
- Bloquear consolidacao de ranking quando houver conflito aberto.

## Regras operacionais
1. Resultado de API entra como rascunho.
2. Resultado revisado manualmente tem prioridade final.
3. Divergencia aberta exige status "pendente_reconciliacao".
4. Sem reconciliacao, nao pode recalcular ranking oficial.

## Entradas esperadas
- id_jogo
- placar_api
- placar_manual
- fonte
- timestamp
- responsavel_revisao

## Saidas esperadas
- resultado_final
- status_reconciliacao
- motivo_bloqueio (quando houver)
- evento_para_ranking (apenas quando reconciliado)

## Fluxo obrigatorio
1. Buscar jogos encerrados.
2. Coletar placar em API.
3. Escrever rascunho em Resultados.
4. Comparar com revisao manual.
5. Definir status final.
6. Publicar evento de consolidacao apenas se reconciliado.

## Dependencias
- regulamento-bolao
- Google Sheets (abas Jogos e Resultados)

## Checklist obrigatoria
A checklist da skill deve ser atualizada em toda rodada.

Arquivo de controle: CHECKLIST-OPERACIONAL.md

## Criterios de aceite
- Resultado final por jogo com rastreabilidade.
- Conflitos detectados e bloqueados corretamente.
- Sem consolidacao automatica quando houver divergencia.

## Historico
- 2026-06-11: versao inicial.
