// The Optional panel section: its membership, what its name selects, and what
// its eye hides. Runs against the compiled package, so build first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { optionalMarks, isShownOnCanvas } from "../dist/components/canvasHelpers.js";

const marks = [
  { id: "a", type: "point", points: [[1, 1]], label: "outlet", source: "engine", optional: true },
  { id: "b", type: "bbox", points: [[0, 0], [9, 9]], label: "panel", source: "human" },
  { id: "c", type: "circle", points: [[0, 0], [4, 4]], label: "outlet", source: "engine", optional: true, group: "g1" },
  { id: "d", type: "line", points: [[0, 0], [5, 5]], label: "wire", source: "human", optional: false },
];
const none = new Set();

test("the section lists the optional marks, in list order, grouped ones included", () => {
  assert.deepEqual(optionalMarks(marks).map((a) => a.id), ["a", "c"]);
});

test("the section's name selects exactly the optional marks", () => {
  const ids = optionalMarks(marks).filter((a) => isShownOnCanvas(a, none, false)).map((a) => a.id);
  assert.deepEqual(ids, ["a", "c"]);
});

test("an explicit false is not optional", () => {
  assert.equal(optionalMarks([marks[3]]).length, 0);
});

test("hiding optional marks hides only them", () => {
  const shown = marks.filter((a) => isShownOnCanvas(a, none, true)).map((a) => a.id);
  assert.deepEqual(shown, ["b", "d"]);
});

test("a hidden class stays hidden whatever the optional eye says", () => {
  const hiddenOutlets = new Set(["outlet"]);
  assert.deepEqual(marks.filter((a) => isShownOnCanvas(a, hiddenOutlets, false)).map((a) => a.id), ["b", "d"]);
  assert.deepEqual(marks.filter((a) => isShownOnCanvas(a, new Set(["wire"]), true)).map((a) => a.id), ["b"]);
});

test("nothing is hidden with neither filter on", () => {
  assert.equal(marks.filter((a) => isShownOnCanvas(a, none, false)).length, marks.length);
});
