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

test("returns unknown for unrecognized input", () => {
  assert.equal(detectIntent("oi tudo bem"), "unknown");
  assert.equal(detectIntent("qual o placar"), "unknown");
});
