import assert from "node:assert/strict";
import test from "node:test";
import { calculateBolaoPoints } from "./scoring.js";

test("awards three points for an exact score", () => {
  assert.deepEqual(calculateBolaoPoints({ home: 2, away: 1 }, { home: 2, away: 1 }), {
    points: 3,
    reason: "exact",
  });
});

test("awards one point for the correct winner with a different score", () => {
  assert.deepEqual(calculateBolaoPoints({ home: 1, away: 0 }, { home: 3, away: 1 }), {
    points: 1,
    reason: "outcome",
  });
});

test("awards one point for a correct draw with a different score", () => {
  assert.deepEqual(calculateBolaoPoints({ home: 1, away: 1 }, { home: 2, away: 2 }), {
    points: 1,
    reason: "outcome",
  });
});

test("awards zero points for an incorrect outcome", () => {
  assert.deepEqual(calculateBolaoPoints({ home: 2, away: 0 }, { home: 0, away: 1 }), {
    points: 0,
    reason: "miss",
  });
});