// Line length labels: how a length reads in feet and inches. Runs against the
// compiled package, so build first: `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatFeetInches } from "../dist/utils/lengthLabel.js";

test("formatFeetInches: whole feet show zero inches", () => {
  assert.equal(formatFeetInches(36), "3'0\"");
  assert.equal(formatFeetInches(96), "8'0\"");
});

test("formatFeetInches: feet and inches", () => {
  assert.equal(formatFeetInches(13), "1'1\"");
  assert.equal(formatFeetInches(12 * 25 + 7), "25'7\"");
});

test("formatFeetInches: under a foot shows inches only", () => {
  assert.equal(formatFeetInches(8), "8\"");
  assert.equal(formatFeetInches(0), "0\"");
});

test("formatFeetInches: rounds to the nearest inch and carries into the feet", () => {
  assert.equal(formatFeetInches(11.6), "1'0\"");
  assert.equal(formatFeetInches(13.4), "1'1\"");
  assert.equal(formatFeetInches(13.5), "1'2\"");
});

test("formatFeetInches: never negative", () => {
  assert.equal(formatFeetInches(-3), "0\"");
});
