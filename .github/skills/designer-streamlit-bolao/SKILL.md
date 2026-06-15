---
name: designer-streamlit-bolao
description: "Use when: criar ou revisar UX/UI do Streamlit para participantes do bolao; definir paleta, tipografia, estilo visual retro anos 90, responsividade mobile, componentes de engajamento, assets de compartilhamento, avatar de usuario, filtros amigaveis e regras de apresentacao nao-admin."
version: 1.0.0
owner: BOTaoDaCopa
lastUpdated: 2026-06-14
---

# Skill: Designer Streamlit Bolao

## Missao
Garantir que o Streamlit do bolao seja uma experiencia de participante, divertida, visualmente marcante e mobile-first, com tom nostalgico de Copa anos 90 e foco em engajamento social.

## Quando usar
Use esta skill quando a tarefa envolver:
- redesign do Streamlit para publico final
- criacao de style guide visual
- responsividade para mobile
- melhoria de filtros, tabelas, cards e navegacao
- criacao de assets para compartilhamento em grupos
- identidade visual de participante (avatar, apelido, destaque no ranking)

## Direcao criativa obrigatoria
- Tema: nostalgia da Copa de 1994, clima retrô popular, alegre e competitivo.
- Evitar cara de painel admin/ERP.
- Priorizar linguagem visual de jogo, torcida e bolao entre amigos.
- Interfaces devem funcionar primeiro no mobile e depois no desktop.

## Paleta recomendada (base)
- Fundo quente: `#FFF3D1`
- Destaque ouro: `#E6B200`
- Verde escuro principal: `#0F3D3E`
- Off-white painel: `#FFFAF0`
- Texto: `#1F2933`
- Alerta: `#A9333A`

## Regras de UX
1. Exibir informacao por nome de participante e por partida, nao por IDs tecnicos.
2. Em `Palpites`, filtros obrigatorios:
   - participante (nome)
   - partida (times + bandeiras)
   - data do jogo
3. Esconder campos internos de admin (`predictionId`, `participantId`, `gameId`, etc.) da visao principal.
4. Exibir avatar do participante em ranking e perfil.
5. Incluir area de compartilhamento com cards/imagens baixaveis.

## Regras de componentes
- Header hero com identidade do bolao.
- Cards de KPI em vez de tabela crua para resumo rapido.
- Ranking com podium visual (top 3) e avatar.
- Tabelas com colunas enxutas e nomes amigaveis.
- CTA claros para compartilhar resultado/ranking.

## Responsividade mobile
- Layout de 1 coluna como baseline.
- Margens pequenas e tipografia legivel em telas estreitas.
- Evitar dependencias de sidebar para funcoes principais.
- Controles grandes para toque (selects, botoes).

## Assets e engajamento
- Todos os assets devem ficar em `streamlit_app/assets/`.
- Gerar cards de compartilhamento em PNG para:
  - ranking
  - desempenho do participante
  - resumo da rodada
- Visual dos cards: bordas fortes, contraste alto, linguagem divertida e elementos de mascote/caricatura.

## Avatar e identidade de usuario
- Permitir escolha de avatar por participante.
- Persistencia inicial local (JSON em assets) e evolucao opcional para Supabase.
- No ranking, sempre exibir `avatar + nome`.

## Supabase (quando necessario)
Se o escopo pedir persistencia multi-dispositivo para avatar/perfil:
1. Criar tabela `participant_profiles`:
   - `participant_id` text PK
   - `display_name` text
   - `avatar` text
   - `updated_at` timestamptz default now()
2. Sincronizar leitura/escrita no carregamento do app.
3. Definir fallback local quando Supabase indisponivel.

## Checklist de entrega
- [ ] Visual nao parece admin.
- [ ] Mobile-first aplicado.
- [ ] Paleta retro consistente.
- [ ] Palpites com filtros por nome, partida e data.
- [ ] Ranking com avatar e destaque top 3.
- [ ] Assets PNG de compartilhamento gerados.
- [ ] IDs tecnicos ocultos da UI principal.

## Historico
- 2026-06-14: versao inicial com regras de visual retro 90s, UX de participante, assets compartilhaveis e avatar.
