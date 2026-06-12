---
name: ranking-bolao
description: Skill para calcular pontuacao e ranking oficial do bolao com base em resultados reconciliados e regra oficial de pontuacao.
version: 1.0.0
owner: BOTaoDaCopa
lastUpdated: 2026-06-11
---

# Skill: Ranking do Bolao

## Missao
Calcular e publicar ranking oficial com transparencia, rastreabilidade e consistencia rodada a rodada.

## Regra de pontuacao oficial
- Placar exato: +3
- Vencedor ou empate correto sem placar exato: +1
- Demais casos: 0

## Escopo
- Ler palpites validos por jogo.
- Ler apenas resultados reconciliados.
- Calcular pontos por palpite.
- Atualizar pontuacao acumulada e ranking.
- Gerar trilha de auditoria de calculo.

## Regras operacionais
1. Nao calcular jogo sem resultado reconciliado.
2. Nao considerar palpite fora do prazo.
3. Reprocessamento deve ser idempotente.
4. Empate em pontos usa criterio de desempate definido em Config.

## Entradas esperadas
- id_jogo
- id_usuario
- palpite
- resultado_final
- prazo_valido

## Saidas esperadas
- pontos_jogo
- pontos_acumulados
- posicao_ranking
- hash_calculo

## Fluxo obrigatorio
1. Carregar jogos reconciliados da rodada.
2. Carregar palpites validos.
3. Aplicar regra oficial de pontuacao.
4. Atualizar abas Pontuacao por Jogo e Ranking.
5. Registrar auditoria da rodada.

## Dependencias
- regulamento-bolao
- ingestao-resultados
- Google Sheets (abas Palpites, Pontuacao por Jogo, Ranking, Config)

## Checklist obrigatoria
A checklist da skill deve ser atualizada em toda consolidacao.

Arquivo de controle: CHECKLIST-OPERACIONAL.md

## Criterios de aceite
- Ranking reproduzivel para a mesma entrada.
- Sem jogos sem reconciliacao no calculo oficial.
- Auditoria com trilha de reprocessamento.

## Historico
- 2026-06-11: versao inicial.
