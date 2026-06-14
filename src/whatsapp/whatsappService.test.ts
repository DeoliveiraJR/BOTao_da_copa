import assert from "node:assert/strict";
import test from "node:test";
import { detectIntent } from "./whatsappService.js";

test("detects prediction intent", () => {
  assert.equal(detectIntent("BRA 2x1 ARG"), "prediction");
  assert.equal(detectIntent("bra 0-0 mex"), "prediction");
  assert.equal(detectIntent("Mexico 2x1 Africa do Sul"), "prediction");
});

test("detects ranking intent", () => {
  assert.equal(detectIntent("ranking"), "ranking");
  assert.equal(detectIntent("RANKING"), "ranking");
  assert.equal(detectIntent("classificação"), "ranking");
  assert.equal(detectIntent("pontos"), "ranking");
});

test("detects games intent", () => {
  assert.equal(detectIntent("jogos"), "games");
  assert.equal(detectIntent("Jogos"), "games");
  assert.equal(detectIntent("rodada"), "games");
  assert.equal(detectIntent("hoje"), "games");
});

test("detects help intent", () => {
  assert.equal(detectIntent("ajuda"), "help");
  assert.equal(detectIntent("help"), "help");
  assert.equal(detectIntent("?"), "help");
});

test("detects oi intent", () => {
  assert.equal(detectIntent("oi"), "oi");
  assert.equal(detectIntent("olá"), "oi");
  assert.equal(detectIntent("Bom dia"), "oi");
  assert.equal(detectIntent("start"), "oi");
});

test("detects panel intent", () => {
  assert.equal(detectIntent("painel"), "panel");
  assert.equal(detectIntent("dashboard"), "panel");
  assert.equal(detectIntent("link"), "panel");
});

test("detects resumo intent", () => {
  assert.equal(detectIntent("resumo"), "resumo");
  assert.equal(detectIntent("Resumo da Rodada"), "resumo");
  assert.equal(detectIntent("sintese"), "resumo");
});

test("returns unknown for unrecognized input", () => {
  assert.equal(detectIntent("oi tudo bem"), "unknown");
  assert.equal(detectIntent("qual o placar"), "unknown");
});
