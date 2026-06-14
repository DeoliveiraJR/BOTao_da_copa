import assert from "node:assert/strict";
import test from "node:test";
import { parsePredictionText } from "./prediction.js";

test("parses a prediction with x separator", () => {
  assert.deepEqual(parsePredictionText("BRA 2x1 ARG"), {
    homeTeam: "BRA",
    awayTeam: "ARG",
    homeGoals: 2,
    awayGoals: 1,
  });
});

test("parses a prediction with dash separator and flexible spacing", () => {
  assert.deepEqual(parsePredictionText("bra  0 - 0  mex"), {
    homeTeam: "BRA",
    awayTeam: "MEX",
    homeGoals: 0,
    awayGoals: 0,
  });
});

test("parses a prediction with full official team names", () => {
  assert.deepEqual(parsePredictionText("Mexico 2x1 Africa do Sul"), {
    homeTeam: "MEXICO",
    awayTeam: "AFRICA DO SUL",
    homeGoals: 2,
    awayGoals: 1,
  });
});

test("rejects an unsupported prediction format", () => {
  assert.equal(parsePredictionText("Brasil ganha de dois"), null);
});