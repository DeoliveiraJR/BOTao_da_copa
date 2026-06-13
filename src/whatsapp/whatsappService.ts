import { parsePredictionText } from "../domain/prediction.js";
import { getRanking } from "../domain/rankingService.js";
import {
  createGameRepository,
  createPredictionRepository,
} from "../sheets/predictionRepositoryFactory.js";

const predictionRepo = createPredictionRepository();
const gameRepo = createGameRepository();

export type Intent = "prediction" | "ranking" | "games" | "help" | "unknown";

const RANKING_PATTERNS = /^(ranking|classifica[cç][aã]o|pontos?)$/i;
const GAMES_PATTERNS = /^(jogos?|partidas?|rodada|hoje|proximos?)$/i;
const HELP_PATTERNS = /^(ajuda|help|\?)$/i;

export function detectIntent(text: string): Intent {
  const normalized = text.trim();
  if (RANKING_PATTERNS.test(normalized)) return "ranking";
  if (GAMES_PATTERNS.test(normalized)) return "games";
  if (HELP_PATTERNS.test(normalized)) return "help";
  if (parsePredictionText(normalized) !== null) return "prediction";
  return "unknown";
}

async function handlePrediction(participantId: string, text: string): Promise<string> {
  const parsed = parsePredictionText(text);
  if (!parsed) return "Formato invalido. Use: BRA 2x1 ARG";

  const alreadyExists = await predictionRepo.hasPrediction(
    participantId,
    parsed.homeTeam,
    parsed.awayTeam,
  );
  if (alreadyExists) {
    return `Voce ja tem palpite para ${parsed.homeTeam} x ${parsed.awayTeam}. Aguarde o resultado!`;
  }

  const game = await gameRepo.findGame(parsed.homeTeam, parsed.awayTeam);
  if (game && (game.status === "in_progress" || game.status === "finished")) {
    const verb = game.status === "finished" ? "terminou" : "comecou";
    return `Prazo encerrado! ${parsed.homeTeam} x ${parsed.awayTeam} ja ${verb}.`;
  }

  await predictionRepo.savePrediction(participantId, {
    ...parsed,
    gameId: game?.id,
  });
  return `Palpite registrado: ${parsed.homeTeam} ${parsed.homeGoals}x${parsed.awayGoals} ${parsed.awayTeam}`;
}

async function handleRanking(): Promise<string> {
  const ranking = await getRanking();
  if (ranking.length === 0) return "Ranking vazio. Faca seu palpite primeiro!";
  const lines = ranking.slice(0, 10).map((e) => `${e.position}. ${e.name} - ${e.totalPoints} pts`);
  return `Ranking:\n${lines.join("\n")}`;
}

async function handleGames(): Promise<string> {
  const upcoming = await gameRepo.listUpcoming(48);
  if (upcoming.length === 0) return "Nenhum jogo nos proximos 2 dias.";
  const lines = upcoming.map((g) => {
    const dt = new Date(g.dateTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `${g.homeTeam} x ${g.awayTeam} - ${dt} (Rodada ${g.round})`;
  });
  return `Proximos jogos:\n${lines.join("\n")}`;
}

function handleHelp(): string {
  return [
    "Comandos:",
    "  BRA 2x1 ARG  - Registrar palpite",
    "  ranking      - Ver classificacao",
    "  jogos        - Ver proximos jogos",
    "  ajuda        - Ver esta mensagem",
  ].join("\n");
}

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
    default:           return "Nao entendi. Digite *ajuda* para ver os comandos.";
  }
}
