import { parsePredictionText } from "../domain/prediction.js";
import { getRanking } from "../domain/rankingService.js";
import { calculateBolaoPoints } from "../domain/scoring.js";
import {
  createGameRepository,
  createPredictionRepository,
  createResultRepository,
} from "../sheets/predictionRepositoryFactory.js";
import { env } from "../config/env.js";

const PANEL_URL = env.STREAMLIT_URL;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeRoundKey(round: string, dateTime: string): string {
  const cleanRound = String(round ?? "").trim();
  if (cleanRound && cleanRound.toUpperCase() !== "N/A") return `round:${cleanRound}`;
  return `date:${String(dateTime).slice(0, 10)}`;
}

function toSaoPauloDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNextSaoPauloDateKey(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const partValue = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const year = partValue("year");
  const month = partValue("month");
  const day = partValue("day");
  const nextUtc = new Date(Date.UTC(year, month - 1, day + 1));

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextUtc);
}

function predictionPayload(input: string): { mode: "create" | "edit"; text: string } {
  const clean = input.trim();
  if (EDIT_PREFIX.test(clean)) {
    return { mode: "edit", text: clean.replace(EDIT_PREFIX, "").trim() };
  }
  return { mode: "create", text: clean };
}

function predictionLink(participantId: string, bolaoId?: string): string {
  const params = new URLSearchParams({ view: "palpites", user: participantId });
  if (bolaoId) params.set("bolaoId", bolaoId);
  return `${PANEL_URL}?${params.toString()}`;
}

function reposForBolao(bolaoId?: string) {
  return {
    predictionRepo: createPredictionRepository(bolaoId),
    gameRepo: createGameRepository(bolaoId),
    resultRepo: createResultRepository(bolaoId),
  };
}

async function listNextDayGamesForPredictions(bolaoId?: string) {
  const { gameRepo } = reposForBolao(bolaoId);
  const games = await gameRepo.listGames();
  const nextDayKey = getNextSaoPauloDateKey();
  return games
    .filter((g) => g.status === "scheduled" && toSaoPauloDateKey(new Date(g.dateTime)) === nextDayKey)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

const PREDICTION_OK = [
  "✅ Palpite registrado com sucesso. Agora e torcer.",
  "📝 Anotado. Sua leitura de jogo foi salva no bolao.",
  "✔️ Registrado. Seguimos no plano rumo ao topo.",
  "🎯 Palpite confirmado no sistema.",
];

const DUPLICATE = [
  "Esse jogo ja tem palpite seu registrado.",
  "Recebi esse mesmo confronto antes. Mantive o primeiro envio.",
  "Uma aposta por jogo ja esta ativa para voce.",
];

const GAME_NOT_FOUND = [
  "Nao localizei esse confronto na tabela oficial. Envie *jogos* para conferir.",
  "Esse jogo nao aparece na grade atual do bolao. Consulte *jogos* e tente novamente.",
];

const DEADLINE_PAST = [
  "Esse confronto ja {verb}. A janela de palpite foi encerrada.",
  "{home} x {away} ja {verb}. Nao consigo mais alterar esse jogo.",
];

const RANKING_EMPTY = [
  "Ranking ainda sem pontuacao. Assim que os jogos fecharem, eu atualizo.",
  "Por enquanto o ranking esta zerado. Vamos abrir os palpites da rodada.",
];

const NO_GAMES = [
  "Nao tem jogo nas proximas 48h. Descansa e volta daqui a pouco.",
  "Agenda vazia por agora. Ja ja aparece jogo novo.",
];

const NEXT_DAY_ONLY = [
  "Pela regra do bolao, hoje so vale palpite para jogos do proximo dia.",
  "Esse jogo nao esta na janela atual. Envie *2* para ver os liberados.",
];

const UNKNOWN = [
  "Nao entendi esse comando. Envie *5* ou *ajuda* para ver as opcoes.",
  "Esse texto nao bateu com os comandos disponiveis. Envie *ajuda*.",
  "Se quiser, eu te guio: mande *5* para abrir o menu completo.",
];

const EDIT_PREFIX = /^(alterar|corrigir|editar|mudar)\s+/i;

export type Intent =
  | "prediction"
  | "ranking"
  | "games"
  | "report"
  | "help"
  | "panel"
  | "oi"
  | "resumo"
  | "sugestao"
  | "unknown";

const RANKING_PATTERNS = /^(1|ranking|classifica[cç][aã]o|pontos?)$/i;
const GAMES_PATTERNS = /^(2|jogos?|partidas?|hoje|proximos?)$/i;
const REPORT_PATTERNS = /^(7|relatorio|relatório|status do dia|quem palpitou|palpites do dia)$/i;
const RESUMO_PATTERNS = /^(3|resumo|rodada|resumo da rodada|sintese|resultado da rodada)$/i;
const PANEL_PATTERNS = /^(4|painel|dashboard|link|placar online|acompanhar)$/i;
const HELP_PATTERNS = /^(5|ajuda|help|\?)$/i;
const OI_PATTERNS = /^(6|oi|ol[aá]|e a[ií]|fala|salve|inicio|start|bom dia|boa tarde|boa noite)$/i;
const SUGESTAO_PATTERNS = /^(sugestao|sugestões|sugerir|pitaco|palpite do bot)$/i;

export function detectIntent(text: string): Intent {
  const normalized = text.trim();
  const payload = predictionPayload(normalized);
  if (RANKING_PATTERNS.test(normalized)) return "ranking";
  if (GAMES_PATTERNS.test(normalized)) return "games";
  if (REPORT_PATTERNS.test(normalized)) return "report";
  if (RESUMO_PATTERNS.test(normalized)) return "resumo";
  if (PANEL_PATTERNS.test(normalized)) return "panel";
  if (HELP_PATTERNS.test(normalized)) return "help";
  if (OI_PATTERNS.test(normalized)) return "oi";
  if (SUGESTAO_PATTERNS.test(normalized)) return "sugestao";
  if (parsePredictionText(payload.text) !== null) return "prediction";
  return "unknown";
}

async function handlePrediction(participantId: string, text: string, bolaoId?: string): Promise<string> {
  const { predictionRepo, gameRepo } = reposForBolao(bolaoId);
  const payload = predictionPayload(text);
  const parsed = parsePredictionText(payload.text);
  if (!parsed) {
    return [
      "Formato invalido.",
      "Exemplo certo: *Mexico 2x1 Africa do Sul*",
      "Pra corrigir palpite digitado errado: *alterar Mexico 2x1 Africa do Sul*",
      "Se quiser ver os jogos validos, manda *2* ou *jogos*.",
    ].join("\n");
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

  const gameDayKey = toSaoPauloDateKey(new Date(game.dateTime));
  const nextDayKey = getNextSaoPauloDateKey();
  if (gameDayKey !== nextDayKey) {
    return [
      pick(NEXT_DAY_ONLY),
      "Manda *2* ou *jogos* pra ver so os jogos liberados.",
    ].join("\n");
  }

  const alreadyExists = await predictionRepo.hasPrediction(participantId, parsed.homeTeam, parsed.awayTeam);

  if (payload.mode === "edit") {
    if (!alreadyExists) {
      return [
        "Nao achei palpite seu pra esse jogo ainda.",
        "Primeiro manda o palpite normal: *TIME A NxM TIME B*.",
      ].join("\n");
    }

    await predictionRepo.upsertPrediction(participantId, { ...parsed, gameId: game.id });
    return [
      "✅ Palpite alterado com sucesso.",
      `Novo registro: *${parsed.homeTeam} ${parsed.homeGoals}x${parsed.awayGoals} ${parsed.awayTeam}*`,
      `Consulta: ${predictionLink(participantId, bolaoId)}`,
    ].join("\n\n");
  }

  if (alreadyExists) {
    return [
      pick(DUPLICATE),
      "Se foi erro de digitacao, corrige assim:",
      `*alterar ${parsed.homeTeam} ${parsed.homeGoals}x${parsed.awayGoals} ${parsed.awayTeam}*`,
    ].join("\n");
  }

  await predictionRepo.savePrediction(participantId, { ...parsed, gameId: game.id });

  return [
    pick(PREDICTION_OK),
    `✅ *${parsed.homeTeam} ${parsed.homeGoals}x${parsed.awayGoals} ${parsed.awayTeam}*`,
    `Consulta: ${predictionLink(participantId, bolaoId)}`,
  ].join("\n\n");
}

async function handleRanking(bolaoId?: string): Promise<string> {
  const ranking = await getRanking(bolaoId);
  if (ranking.length === 0) return pick(RANKING_EMPTY);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = ranking.slice(0, 10).map((e) => {
    const icon = medals[e.position - 1] ?? `${e.position}.`;
    return `${icon} ${e.name} — ${e.totalPoints} pts`;
  });

  const leader = ranking[0];
  const taunt = ranking.length > 1
    ? `\n\nLider agora: *${leader.name}* com *${leader.totalPoints} pts*. Pressao ta em quem vem atras.`
    : "";

  return `🏆 *Ranking do Bolao*\n\n${lines.join("\n")}${taunt}`;
}

async function handleGames(bolaoId?: string): Promise<string> {
  const upcoming = await listNextDayGamesForPredictions(bolaoId);
  if (upcoming.length === 0) {
    return "Nao achei jogo liberado pra palpitar no proximo dia ainda. Assim que a tabela abrir, eu te aviso por aqui.";
  }

  const lines = upcoming.map((g) => {
    const dt = new Date(g.dateTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `⚽ *${g.homeTeam} x ${g.awayTeam}*\n   ${dt}`;
  });

  return [
    "📅 *Proximos jogos para palpitar (proximo dia)*",
    "",
    ...lines,
    "",
    "Pra palpitar: *TIME A NxM TIME B*",
    "Pra corrigir erro de digitacao: *alterar TIME A NxM TIME B*",
  ].join("\n");
}

function normalizeGameId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (/^\d+\.0$/.test(text)) return text.slice(0, -2);
  return text;
}

async function handleDailyReport(bolaoId?: string): Promise<string> {
  const { predictionRepo, gameRepo } = reposForBolao(bolaoId);
  const [predictions, games, ranking] = await Promise.all([
    predictionRepo.listPredictions(),
    gameRepo.listGames(),
    getRanking(bolaoId),
  ]);

  const todayKey = toSaoPauloDateKey(new Date());
  const rankingNameMap = new Map(ranking.map((item) => [item.participantId, item.name] as const));
  const gameMap = new Map(games.map((g) => [normalizeGameId(g.id), g] as const));

  const todayPredictions = predictions.filter((item) => {
    if (item.isDeleted) return false;
    const createdAt = new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    return toSaoPauloDateKey(createdAt) === todayKey;
  });

  if (todayPredictions.length === 0) {
    return [
      "🗂️ *Relatório de Palpites do Dia*",
      "",
      "Ainda não há palpites registrados hoje.",
    ].join("\n");
  }

  const summary = new Map<string, { name: string; count: number; matches: string[] }>();
  for (const prediction of todayPredictions) {
    const participantId = String(prediction.participantId);
    const current = summary.get(participantId) ?? {
      name: rankingNameMap.get(participantId) ?? participantId,
      count: 0,
      matches: [],
    };

    const game = gameMap.get(normalizeGameId(prediction.gameId));
    const matchLabel = game
      ? `${game.homeTeam} x ${game.awayTeam}`
      : `${prediction.homeTeam} x ${prediction.awayTeam}`;

    current.count += 1;
    if (!current.matches.includes(matchLabel)) {
      current.matches.push(matchLabel);
    }
    summary.set(participantId, current);
  }

  const participantLines = Array.from(summary.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((entry) => {
      const previewMatches = entry.matches.slice(0, 3).join(", ");
      const extra = entry.matches.length > 3 ? ` +${entry.matches.length - 3}` : "";
      return `• ${entry.name}: ${entry.count} palpite(s) — ${previewMatches}${extra}`;
    });

  return [
    "🗂️ *Relatório de Palpites do Dia*",
    `Data: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    "",
    ...participantLines,
    "",
    `Total de palpites hoje: *${todayPredictions.length}*`,
    `Participantes ativos hoje: *${summary.size}*`,
  ].join("\n");
}

async function handleResumo(bolaoId?: string): Promise<string> {
  const { predictionRepo, gameRepo, resultRepo } = reposForBolao(bolaoId);
  const [predictions, confirmedResults, ranking, games] = await Promise.all([
    predictionRepo.listPredictions(),
    resultRepo.listConfirmedResults(),
    getRanking(bolaoId),
    gameRepo.listGames(),
  ]);

  if (confirmedResults.length === 0) {
    return "Ainda nao tem resultado confirmado. Quando fechar a rodada, eu te mostro o resumo bonito.";
  }

  const gameById = new Map(games.map((g) => [g.id, g]));
  const validResults = confirmedResults
    .filter((r) => r.homeGoalsManual !== null && r.awayGoalsManual !== null)
    .map((r) => ({ ...r, game: gameById.get(r.gameId) }))
    .filter((r): r is typeof r & { game: NonNullable<typeof r.game> } => !!r.game);

  if (validResults.length === 0) {
    return "Sem jogo mapeado pra montar o resumo da rodada ainda.";
  }

  // Rodada vigente = grupo mais recente por round (quando existe) ou data (fallback)
  const latest = validResults.reduce((acc, item) => {
    const t = new Date(item.game.dateTime).getTime();
    if (!acc || t > acc.time) {
      return { key: normalizeRoundKey(item.game.round, item.game.dateTime), time: t };
    }
    return acc;
  }, null as null | { key: string; time: number });

  if (!latest) return "Nao consegui identificar a ultima rodada vigente.";

  const roundResults = validResults.filter(
    (r) => normalizeRoundKey(r.game.round, r.game.dateTime) === latest.key,
  );

  type ParticipantSummary = { exact: number; outcome: number; miss: number; roundPoints: number };
  const summary = new Map<string, ParticipantSummary>();

  const gameLines = roundResults.map((result) => {
    const actual = { home: result.homeGoalsManual as number, away: result.awayGoalsManual as number };
    const gamePreds = predictions.filter((p) => !p.isDeleted && p.gameId === result.gameId);

    let exactCount = 0;
    let outcomeCount = 0;

    for (const pred of gamePreds) {
      const score = calculateBolaoPoints({ home: pred.homeGoals, away: pred.awayGoals }, actual);
      if (score.reason === "exact") exactCount += 1;
      if (score.reason === "exact" || score.reason === "outcome") outcomeCount += 1;

      const current = summary.get(pred.participantId) ?? { exact: 0, outcome: 0, miss: 0, roundPoints: 0 };
      if (score.reason === "exact") current.exact += 1;
      else if (score.reason === "outcome") current.outcome += 1;
      else current.miss += 1;
      current.roundPoints += score.points;
      summary.set(pred.participantId, current);
    }

    return `⚽ ${result.game.homeTeam} ${actual.home}x${actual.away} ${result.game.awayTeam} — ${exactCount} placar(es) exato(s), ${outcomeCount} acerto(s) de resultado`;
  });

  const rankingMap = new Map(ranking.map((r) => [r.participantId, r]));

  const participantLines = Array.from(summary.entries())
    .sort((a, b) => b[1].roundPoints - a[1].roundPoints)
    .map(([id, s]) => {
      const rank = rankingMap.get(id);
      const name = rank?.name ?? id;
      const total = rank?.totalPoints ?? 0;
      return `• ${name}: +${s.roundPoints} pts na rodada (${s.exact} exatos, ${s.outcome} resultado, ${s.miss} erros) | acumulado: ${total} pts`;
    });

  const roundLabel = latest.key.startsWith("round:")
    ? latest.key.replace("round:", "")
    : `Data ${latest.key.replace("date:", "")}`;

  const leader = ranking[0];

  return [
    "📋 *Resumo da Rodada Vigente*",
    `Rodada: *${roundLabel}*`,
    "",
    ...gameLines,
    "",
    "*Desempenho dos participantes na rodada:*",
    ...(participantLines.length > 0 ? participantLines : ["Ninguem pontuou nessa rodada ainda."]),
    "",
    leader
      ? `Lider geral: *${leader.name}* com *${leader.totalPoints} pts*.`
      : "Ranking geral ainda vazio.",
  ].join("\n");
}

async function handleSugestao(bolaoId?: string): Promise<string> {
  const upcoming = await listNextDayGamesForPredictions(bolaoId);
  if (upcoming.length === 0) {
    return "Sem jogo liberado no proximo dia pra sugerir agora. Manda *2* pra acompanhar quando abrir nova janela.";
  }

  const picks = upcoming.slice(0, 3).map((g, idx) => {
    const seed = (g.id.length + idx + new Date(g.dateTime).getDate()) % 3;
    const suggested = seed === 0 ? "1x0" : seed === 1 ? "1x1" : "2x1";
    return `• ${g.homeTeam} x ${g.awayTeam}: sugestao ${suggested}`;
  });

  return [
    "🧠 *Pitaco do BOTao* (sugestao rapida)",
    ...picks,
    "",
    "Quer registrar? Manda no formato: *TIME A NxM TIME B*",
    "Obs: e sugestao, nao milagre. 😅",
  ].join("\n");
}

function handlePanel(participantId: string, bolaoId?: string): string {
  const params = new URLSearchParams({ view: "painel", user: participantId });
  if (bolaoId) params.set("bolaoId", bolaoId);
  return `📊 *Painel do Bolao*\n\nRanking, palpites e resultados em tempo real:\n${PANEL_URL}?${params.toString()}`;
}

function handleGreeting(): string {
  return [
    "🎩👋 Salve meu camarada, sou o *Milton Barata*.",
    "Com anos de larga experiencia em compliance e ouvidoria do jogo do bicho, ja fui caixeiro viajante e hoje assumo essa bodega.",
    "",
    "📡 Cuido do seu bolão no WhatsApp: registro palpite, atualizo ranking e trago o resumo da rodada.",
    "",
    "*Menu Premium (também funciona por número):*",
    "🥇 1 ou ranking      -> classificação atual",
    "📅 2 ou jogos        -> jogos liberados para palpitar (próximo dia)",
    "🧾 3 ou resumo       -> resumo da última rodada vigente",
    "🖥️ 4 ou painel       -> link do painel online",
    "🛟 5 ou ajuda        -> guia de comandos",
    "🎙️ 6 ou oi           -> mostrar esta apresentação",
    "📊 7 ou relatorio    -> quem já palpitou hoje",
    "🔁 0 ou trocar bolao -> trocar o bolão ativo",
    "",
    "✍️ Para palpitar: *Mexico 2x1 Africa do Sul*",
    "🛠️ Para corrigir: *alterar Mexico 2x1 Africa do Sul*",
    "🧠 Se quiser um chute meu, envie *sugestao*.",
  ].join("\n");
}

function handleHelp(): string {
  return [
    "📘 *Ajuda Oficial - Milton Barata (BOTao da Copa 2026)*",
    "",
    "*Comandos:*",
    "🥇 1 ou ranking      -> ver classificação",
    "📅 2 ou jogos        -> ver jogos liberados para palpitar (próximo dia)",
    "🧾 3 ou resumo       -> resumo da rodada vigente",
    "🖥️ 4 ou painel       -> abrir painel web",
    "🛟 5 ou ajuda        -> voltar neste guia",
    "🎙️ 6 ou oi           -> apresentação do bot",
    "📊 7 ou relatorio    -> relatório diário de palpites",
    "🔁 0 ou trocar bolao -> selecionar outro bolão",
    "🧠 sugestao          -> pitaco rápido do bot",
    "",
    "*Para registrar palpite:*",
    "Use: *TIME A NxM TIME B*",
    "Ex: *Mexico 2x1 Africa do Sul*",
    "Para corrigir: *alterar TIME A NxM TIME B* (só antes do jogo começar)",
    "",
    "*Regras do bolão:*",
    "• Hoje, só pode palpitar nos jogos do próximo dia",
    "• 1 palpite por jogo (pode corrigir só antes do início)",
    "• Placar exato = 3 pts",
    "• Resultado certo = 1 pt",
    "• Erro = 0 pt",
  ].join("\n");
}

export type IncomingWhatsAppMessage = {
  participantId: string;
  text: string;
  bolaoId?: string;
};

export async function processWhatsAppMessage(input: IncomingWhatsAppMessage): Promise<string> {
  const intent = detectIntent(input.text);
  switch (intent) {
    case "prediction": return handlePrediction(input.participantId, input.text, input.bolaoId);
    case "ranking":    return handleRanking(input.bolaoId);
    case "games":      return handleGames(input.bolaoId);
    case "report":     return handleDailyReport(input.bolaoId);
    case "resumo":     return handleResumo(input.bolaoId);
    case "panel":      return handlePanel(input.participantId, input.bolaoId);
    case "help":       return handleHelp();
    case "oi":         return handleGreeting();
    case "sugestao":   return handleSugestao(input.bolaoId);
    default:            return pick(UNKNOWN);
  }
}
