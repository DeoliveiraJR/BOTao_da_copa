import { parsePredictionText } from "../domain/prediction.js";
import { getRanking } from "../domain/rankingService.js";
import { calculateBolaoPoints } from "../domain/scoring.js";
import {
  createGameRepository,
  createPredictionRepository,
  createResultRepository,
} from "../sheets/predictionRepositoryFactory.js";
import { env } from "../config/env.js";

const predictionRepo = createPredictionRepository();
const gameRepo = createGameRepository();
const resultRepo = createResultRepository();

// ── Persona ───────────────────────────────────────────────────────────────────

const PANEL_URL = env.STREAMLIT_URL;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const PREDICTION_OK = [
  "Anotado! Torce que acerta e torce ainda mais que os outros erram. ⚽",
  "Registrado. Confiante assim so vendo — mas pode ser que dessa vez seja a sua vez.",
  "Palpite no sistema. Agora e so esperar e rezar para o VAR nao estragar tudo.",
  "Fechado! Se acertar, fica a vontade pra comemorar muito.",
  "Guardado com carinho. Nao se esqueca: um palpite por jogo, sem segunda chance.",
];

const DUPLICATE = [
  "Calma, ansioso(a). Voce ja tem palpite pra esse jogo. Aguarda o apito final.",
  "Palpite duplicado detectado. Uma aposta por jogo — regra sagrada do bolao.",
  "Ja registrado! Se pudesse mudar, todo mundo seria vidente.",
];

const GAME_NOT_FOUND = [
  "Esse confronto nao consta na tabela oficial. Confira os proximos jogos com *jogos*.",
  "Jogo nao encontrado. O calendario oficial nao mente — cheque com *jogos*.",
];

const DEADLINE_PAST = [
  "Atrasado(a)! O jogo ja {verb} e o prazo encerrou. Na proxima, chegue antes.",
  "O trem ja saiu. {home} x {away} ja {verb}. Tente no proximo.",
];

const RANKING_EMPTY = [
  "Ranking zerado. Ou ninguem apostou ainda, ou todos estao com medo de aparecer.",
  "Nenhum ponto no ranking ainda. O bolao esta no modo timido.",
];

const NO_GAMES = [
  "Nenhum jogo nas proximas 48h. Aproveita pra estudar a tabela antes que seja tarde.",
  "Janela sem jogos. Descansa as teorias de palpite ate o proximo compromisso.",
];

const UNKNOWN = [
  "Nao entendi nada. Tenta *ajuda* — sem julgamentos.",
  "Hm... isso nao e um palpite nem um comando valido. Tenta *ajuda*.",
  "Comando misterioso. O BOTao nao e adivinho. Digite *ajuda*.",
];

// ── Intents ───────────────────────────────────────────────────────────────────

export type Intent = "prediction" | "ranking" | "games" | "help" | "panel" | "oi" | "resumo" | "unknown";

const RANKING_PATTERNS = /^(ranking|classifica[cç][aã]o|pontos?)$/i;
const GAMES_PATTERNS   = /^(jogos?|partidas?|rodada|hoje|proximos?)$/i;
const HELP_PATTERNS    = /^(ajuda|help|\?)$/i;
const PANEL_PATTERNS   = /^(painel|dashboard|link|placar online|acompanhar)$/i;
const OI_PATTERNS      = /^(oi|ol[aá]|e a[ií]|fala|hey|boa tarde|bom dia|boa noite|salve|inicio|start)$/i;
const RESUMO_PATTERNS  = /^(resumo|rodada|resumo da rodada|sintese|resultado da rodada)$/i;

export function detectIntent(text: string): Intent {
  const normalized = text.trim();
  if (RANKING_PATTERNS.test(normalized)) return "ranking";
  if (GAMES_PATTERNS.test(normalized))   return "games";
  if (HELP_PATTERNS.test(normalized))    return "help";
  if (PANEL_PATTERNS.test(normalized))   return "panel";
  if (OI_PATTERNS.test(normalized))      return "oi";
  if (RESUMO_PATTERNS.test(normalized))  return "resumo";
  if (parsePredictionText(normalized) !== null) return "prediction";
  return "unknown";
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handlePrediction(participantId: string, text: string): Promise<string> {
  const parsed = parsePredictionText(text);
  if (!parsed) {
    return "Formato invalido. Use os nomes oficiais do confronto.\nExemplo: *Mexico 2x1 Africa do Sul*\nDigite *jogos* para ver os confrontos validos.";
  }

  const game = await gameRepo.findGame(parsed.homeTeam, parsed.awayTeam);
  if (!game) {
    return `${parsed.homeTeam} x ${parsed.awayTeam} — ${pick(GAME_NOT_FOUND)}`;
  }

  if (game.status === "in_progress" || game.status === "finished") {
    const verb = game.status === "finished" ? "terminou" : "comecou";
    return pick(DEADLINE_PAST)
      .replace("{verb}", verb)
      .replace("{home}", parsed.homeTeam)
      .replace("{away}", parsed.awayTeam);
  }

  const alreadyExists = await predictionRepo.hasPrediction(participantId, parsed.homeTeam, parsed.awayTeam);
  if (alreadyExists) return pick(DUPLICATE);

  await predictionRepo.savePrediction(participantId, { ...parsed, gameId: game.id });

  return `${pick(PREDICTION_OK)}\n\n⚽ *${parsed.homeTeam} ${parsed.homeGoals}x${parsed.awayGoals} ${parsed.awayTeam}*`;
}

async function handleRanking(): Promise<string> {
  const ranking = await getRanking();
  if (ranking.length === 0) return pick(RANKING_EMPTY);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = ranking.slice(0, 10).map((e) => {
    const icon = medals[e.position - 1] ?? `${e.position}.`;
    return `${icon} ${e.name} — ${e.totalPoints} pts`;
  });

  const leader = ranking[0];
  const taunt = ranking.length > 1
    ? `\n\n${leader.name} na lideranca com ${leader.totalPoints} pts. Os outros ainda acreditam.`
    : "";

  return `🏆 *Ranking do Bolao*\n\n${lines.join("\n")}${taunt}`;
}

async function handleGames(): Promise<string> {
  const upcoming = await gameRepo.listUpcoming(48);
  if (upcoming.length === 0) return pick(NO_GAMES);

  const lines = upcoming.map((g) => {
    const dt = new Date(g.dateTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `⚽ *${g.homeTeam} x ${g.awayTeam}*\n   ${dt}`;
  });

  return `📅 *Proximos jogos (48h)*\n\n${lines.join("\n\n")}\n\nManda seu palpite antes que o apito toque!`;
}

function handlePanel(): string {
  return `📊 *Painel do Bolao*\n\nAcompanhe ranking, palpites e resultados em tempo real:\n${PANEL_URL}\n\nSo nao culpe o painel se a sorte nao ajudar.`;
}

function handleGreeting(): string {
  return [
    "👋 Fala, craque! Eu sou o *BOTao da Copa 2026* ⚽",
    "",
    "Gestor oficial deste bolao. Anoto palpites, calculo pontos e exponho quem chutou errado — sem pena.",
    "",
    "*O que voce pode fazer:*",
    "⚽  Palpitar: ex: *Mexico 2x1 Africa do Sul*",
    "🏆  Ver ranking: *ranking*",
    "📅  Ver proximos jogos: *jogos*",
    "📊  Resumo da rodada: *resumo*",
    "🔗  Painel online: *painel*",
    "❓  Ajuda: *ajuda*",
    "",
    "Bora ver se voce e bom mesmo ou so parece nas conversas. 😏",
  ].join("\n");
}

async function handleResumo(): Promise<string> {
  const [predictions, confirmedResults, ranking] = await Promise.all([
    predictionRepo.listPredictions(),
    resultRepo.listConfirmedResults(),
    getRanking(),
  ]);

  if (confirmedResults.length === 0) {
    return "Ainda nao ha resultados confirmados nesta rodada. Aguarda o apito final!";
  }

  const recentResults = confirmedResults.slice(-5);

  type ParticipantSummary = { exact: number; outcome: number; miss: number; points: number };
  const summary = new Map<string, ParticipantSummary>();

  for (const result of recentResults) {
    if (result.homeGoalsManual === null || result.awayGoalsManual === null) continue;
    const actual = { home: result.homeGoalsManual, away: result.awayGoalsManual };

    for (const pred of predictions) {
      if (pred.gameId !== result.gameId) continue;
      if (pred.isDeleted) continue;

      const { points, reason } = calculateBolaoPoints(
        { home: pred.homeGoals, away: pred.awayGoals },
        actual,
      );

      const current = summary.get(pred.participantId) ?? { exact: 0, outcome: 0, miss: 0, points: 0 };
      if (reason === "exact") current.exact++;
      else if (reason === "outcome") current.outcome++;
      else current.miss++;
      current.points += points;
      summary.set(pred.participantId, current);
    }
  }

  const rankingMap = new Map(ranking.map((r) => [r.participantId, r.name]));

  const games = recentResults.map((r) => {
    const exactCount = Array.from(summary.values()).reduce((acc, s) => acc + (s.exact > 0 ? 1 : 0), 0);
    return `⚽ Jogo ${r.gameId}: *${r.homeGoalsManual} x ${r.awayGoalsManual}* — ${exactCount} placar(es) exato(s)`;
  });

  const participantLines = Array.from(summary.entries())
    .sort((a, b) => b[1].points - a[1].points)
    .map(([id, s]) => {
      const name = rankingMap.get(id) ?? id;
      return `• ${name}: +${s.points} pts (${s.exact} exatos, ${s.outcome} resultado certo, ${s.miss} erros)`;
    });

  const leader = ranking[0];
  const closer = `\n\n${leader ? `Lider geral: *${leader.name}* com *${leader.totalPoints} pts*. Ainda da pra virar? Depende de quem perguntar. 😏` : ""}`;

  return [
    "📋 *Resumo da Rodada*",
    "",
    ...games,
    "",
    "*Desempenho dos participantes:*",
    ...participantLines,
    closer,
  ].join("\n");
}

function handleHelp(): string {
  return [
    "❓ *Ajuda — BOTao da Copa 2026*",
    "",
    "⚽ *Palpite:* ex: *Mexico 2x1 Africa do Sul*",
    "🏆 *ranking* — Classificacao atual",
    "📅 *jogos* — Proximos jogos (48h)",
    "📋 *resumo* — Resumo da rodada recente",
    "🔗 *painel* — Link do painel online",
    "👋 *oi* — Apresentacao do BOTao",
    "❓ *ajuda* — Esta mensagem",
    "",
    "📌 *Regras:* 1 palpite por jogo | prazo: antes do apito",
    "🏅 *Pontuacao:* placar exato = 3 pts | resultado certo = 1 pt | erro = 0",
  ].join("\n");
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export type IncomingWhatsAppMessage = {
  participantId: string;
  text: string;
};

export async function processWhatsAppMessage(input: IncomingWhatsAppMessage): Promise<string> {
  const intent = detectIntent(input.text);
  switch (intent) {
    case "prediction": return handlePrediction(input.participantId, input.text);
    case "ranking":    return handleRanking();
    case "games":      return handleGames();
    case "help":       return handleHelp();
    case "panel":      return handlePanel();
    case "oi":         return handleGreeting();
    case "resumo":     return handleResumo();
    default:           return pick(UNKNOWN);
  }
}
