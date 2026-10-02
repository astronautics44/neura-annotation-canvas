// Volume as a symbol size: three dimensions in one unit. Runs against the
// compiled package, so build first: `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SYMBOL_SIZE_ATTRIBUTES,
  parseDimensions,
  parseSymbolSize,
  formatSymbolSize,
  formatSymbolSizeLabel,
} from "../dist/utils/symbolSize.js";

test("volume is offered alongside the one-dimensional attributes", () => {
  assert.ok(DEFAULT_SYMBOL_SIZE_ATTRIBUTES.includes("volume"));
  assert.ok(DEFAULT_SYMBOL_SIZE_ATTRIBUTES.includes("diameter"));
});

test("dimensions are read in every common spelling", () => {
  for (const input of ["3x4x5", "3 x 4 x 5", "3X4X5", "3×4×5", "3*4*5", "3 by 4 by 5"]) {
    assert.deepEqual(parseDimensions(input), [3, 4, 5], input);
  }
  assert.deepEqual(parseDimensions("2.5x1x0.5"), [2.5, 1, 0.5]);
});

test("anything but three positive numbers is refused", () => {
  for (const input of ["", "3", "3x4", "3x4x5x6", "3xx5", "3x0x5", "3x-4x5", "3xax5", "x4x5"]) {
    assert.equal(parseDimensions(input), undefined, input);
  }
});

test("a stored volume round-trips, with its product as value", () => {
  const meta = { symbolSize: { attribute: "volume", value: 60, unit: "in", dimensions: [3, 4, 5] } };
  assert.deepEqual(parseSymbolSize(meta), meta.symbolSize);
});

test("a stale value is recomputed from the dimensions", () => {
  const size = parseSymbolSize({ symbolSize: { attribute: "volume", value: 1, unit: "ft", dimensions: [2, 2, 1] } });
  assert.equal(size.value, 4);
});

test("bad dimensions fall back to the plain value, and a one-dimensional size is unchanged", () => {
  const bad = parseSymbolSize({ symbolSize: { attribute: "volume", value: 60, unit: "in", dimensions: [3, 0, 5] } });
  assert.deepEqual(bad, { attribute: "volume", value: 60, unit: "in" });
  const pipe = parseSymbolSize({ symbolSize: { attribute: "diameter", value: 12, unit: "mm" } });
  assert.deepEqual(pipe, { attribute: "diameter", value: 12, unit: "mm" });
  assert.equal("dimensions" in pipe, false);
});

test("display names all three dimensions in the one unit", () => {
  const size = { attribute: "volume", value: 60, unit: "in", dimensions: [3, 4, 5] };
  assert.equal(formatSymbolSize(size), "volume 3×4×5in");
  assert.equal(formatSymbolSizeLabel(size), "volume - 3×4×5in (60in³)");
  assert.equal(formatSymbolSize({ attribute: "diameter", value: 12, unit: "mm" }), "diameter 12mm");
  assert.equal(formatSymbolSizeLabel({ attribute: "diameter", value: 12, unit: "mm" }), "diameter - 12mm");
});
