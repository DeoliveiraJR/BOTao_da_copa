import assert from "node:assert/strict";
import test from "node:test";
import { detectIntent } from "./whatsappService.js";

test("detects prediction intent", () => {
  assert.equal(detectIntent("BRA 2x1 ARG"), "prediction");
  assert.equal(detectIntent("bra 0-0 mex"), "prediction");
  assert.equal(detectIntent("Mexico 2x1 Africa do Sul"), "prediction");
  assert.equal(detectIntent("alterar Mexico 2x1 Africa do Sul"), "prediction");
  assert.equal(detectIntent("corrigir BRA 1x0 ARG"), "prediction");
});

test("detects ranking intent", () => {
  assert.equal(detectIntent("ranking"), "ranking");
  assert.equal(detectIntent("RANKING"), "ranking");
  assert.equal(detectIntent("classificação"), "ranking");
  assert.equal(detectIntent("pontos"), "ranking");
  assert.equal(detectIntent("1"), "ranking");
});

test("detects games intent", () => {
  assert.equal(detectIntent("jogos"), "games");
  assert.equal(detectIntent("Jogos"), "games");
  assert.equal(detectIntent("hoje"), "games");
  assert.equal(detectIntent("2"), "games");
});

test("detects help intent", () => {
  assert.equal(detectIntent("ajuda"), "help");
  assert.equal(detectIntent("help"), "help");
  assert.equal(detectIntent("?"), "help");
  assert.equal(detectIntent("5"), "help");
});

test("detects oi intent", () => {
  assert.equal(detectIntent("oi"), "oi");
  assert.equal(detectIntent("olá"), "oi");
  assert.equal(detectIntent("Bom dia"), "oi");
  assert.equal(detectIntent("start"), "oi");
  assert.equal(detectIntent("6"), "unknown");
});

test("detects panel intent", () => {
  assert.equal(detectIntent("painel"), "panel");
  assert.equal(detectIntent("dashboard"), "panel");
  assert.equal(detectIntent("link"), "panel");
  assert.equal(detectIntent("4"), "panel");
});

test("detects resumo intent", () => {
  assert.equal(detectIntent("resumo"), "resumo");
  assert.equal(detectIntent("Resumo da Rodada"), "resumo");
  assert.equal(detectIntent("sintese"), "resumo");
  assert.equal(detectIntent("rodada"), "resumo");
  assert.equal(detectIntent("3"), "resumo");
});

test("detects sugestao intent", () => {
  assert.equal(detectIntent("sugestao"), "sugestao");
  assert.equal(detectIntent("pitaco"), "sugestao");
  assert.equal(detectIntent("palpite do bot"), "sugestao");
});

test("returns unknown for unrecognized input", () => {
  assert.equal(detectIntent("oi tudo bem"), "unknown");
  assert.equal(detectIntent("qual o placar"), "unknown");
});
