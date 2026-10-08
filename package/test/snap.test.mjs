// Snapping to the ends of lines and polylines. Runs against the compiled
// package, so build first: `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestEndpoint } from "../dist/components/canvasHelpers.js";

const marks = [
  { id: "l", type: "line", points: [[0, 0], [100, 0]], label: "wall", source: "human" },
  { id: "y", type: "polyline", points: [[200, 0], [250, 50], [300, 0]], label: "pipe", source: "engine" },
  { id: "g", type: "polygon", points: [[500, 500], [600, 500], [600, 600]], label: "slab", source: "human" },
  { id: "b", type: "bbox", points: [[700, 700], [800, 800]], label: "door", source: "human" },
  { id: "p", type: "point", points: [[900, 900]], label: "column", source: "human" },
];

test("a point near a line or polyline end lands on it", () => {
  assert.deepEqual(nearestEndpoint(marks, [104, 3], 10), [100, 0]);
  assert.deepEqual(nearestEndpoint(marks, [296, -4], 10), [300, 0]);
  assert.deepEqual(nearestEndpoint(marks, [-2, 2], 10), [0, 0]);
});

test("out of reach, nothing snaps", () => {
  assert.equal(nearestEndpoint(marks, [120, 0], 10), null);
  assert.equal(nearestEndpoint(marks, [50, 0], 10), null);
});

test("only ends: inner vertices and other shapes never snap", () => {
  assert.equal(nearestEndpoint(marks, [250, 50], 10), null);
  assert.equal(nearestEndpoint(marks, [500, 500], 10), null);
  assert.equal(nearestEndpoint(marks, [700, 700], 10), null);
  assert.equal(nearestEndpoint(marks, [900, 900], 10), null);
});

test("the nearest end wins", () => {
  const close = [
    { id: "a", type: "line", points: [[0, 0], [10, 0]], label: "x", source: "human" },
    { id: "b", type: "line", points: [[14, 0], [40, 0]], label: "x", source: "human" },
  ];
  assert.deepEqual(nearestEndpoint(close, [13, 0], 10), [14, 0]);
  assert.deepEqual(nearestEndpoint(close, [11, 0], 10), [10, 0]);
});

test("the mark being dragged does not snap to itself", () => {
  assert.equal(nearestEndpoint(marks, [101, 0], 10, "l"), null);
  assert.deepEqual(nearestEndpoint(marks, [201, 0], 10, "l"), [200, 0]);
});
