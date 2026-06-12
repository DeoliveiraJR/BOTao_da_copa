---
name: narracao-bolao
description: Skill para gerar mensagens pre-jogo e pos-rodada com sintese do bolao, tom moderadamente sarcastico e regras de seguranca de linguagem.
version: 1.0.0
owner: BOTaoDaCopa
lastUpdated: 2026-06-11
---

# Skill: Narracao do Bolao

## Missao
Engajar os participantes com mensagens uteis e divertidas, mantendo clareza, respeito e contexto esportivo.

## Escopo
- Gerar lembrete pre-jogo.
- Gerar sintese pos-rodada.
- Gerar comentario curto de ranking.
- Adaptar tom para sarcasmo moderado, sem ofensa.

## Regras de linguagem
1. Pode usar ironia leve e brincadeira esportiva.
2. Nao pode usar humilhacao, ataque pessoal ou linguagem discriminatoria.
3. Em caso de ambiguidade, usar tom neutro.
4. Mensagens devem ser curtas e objetivas para WhatsApp.

## Entradas esperadas
- rodada
- top_ranking
- destaques_positivos
- destaques_negativos
- jogos_da_proxima_rodada

## Saidas esperadas
- mensagem_pre_jogo
- mensagem_pos_rodada
- mensagem_ranking

## Templates obrigatorios
- Pre-jogo: jogos + prazo final para palpites + chamada para acao.
- Pos-rodada: top 3 + variacao de posicoes + frase de engajamento.
- Ranking: status rapido + proxima janela de palpites.

## Dependencias
- regulamento-bolao
- ranking-bolao
- Google Sheets (abas Ranking, Rodadas Resumo, Jogos)

## Checklist obrigatoria
A checklist da skill deve ser atualizada em cada publicacao automatica.

Arquivo de controle: CHECKLIST-OPERACIONAL.md

## Criterios de aceite
- Mensagens claras e consistentes com dados da rodada.
- Tom moderado sem violacao de seguranca.
- Publicacoes com horario e contexto corretos.

## Historico
- 2026-06-11: versao inicial.
