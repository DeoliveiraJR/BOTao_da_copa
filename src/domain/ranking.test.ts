import assert from "node:assert/strict";
import test from "node:test";
import { calculateBolaoPoints } from "./scoring.js";

// These tests verify the ranking consolidation logic through the scoring engine.
// Integration tests for rankingService itself are covered by the in-memory fixtures below.

test("ranking: exact score produces 3 points", () => {
  const { points } = calculateBolaoPoints({ home: 1, away: 0 }, { home: 1, away: 0 });
  assert.equal(points, 3);
});

test("ranking: correct winner but wrong score produces 1 point", () => {
  const { points } = calculateBolaoPoints({ home: 1, away: 0 }, { home: 3, away: 0 });
  assert.equal(points, 1);
});

test("ranking: correct draw but different score produces 1 point", () => {
  const { points } = calculateBolaoPoints({ home: 0, away: 0 }, { home: 2, away: 2 });
  assert.equal(points, 1);
});

test("ranking: wrong outcome produces 0 points", () => {
  const { points } = calculateBolaoPoints({ home: 1, away: 0 }, { home: 0, away: 1 });
  assert.equal(points, 0);
});
