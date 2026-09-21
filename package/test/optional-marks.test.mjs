// Optional marks: the reducer half of the gesture. Runs against the compiled
// package, so build first: `npm run build --workspace=package`. Node's own test
// runner, so this adds no dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { annotationReducer, allOptional } from "../dist/components/canvasHelpers.js";

const shapes = [
  { id: "p", type: "point", points: [[10, 10]], label: "outlet", source: "engine", confidence: 0.9 },
  { id: "b", type: "bbox", points: [[0, 0], [20, 20]], label: "panel", source: "human", group: "g1" },
  { id: "l", type: "line", points: [[0, 0], [5, 5]], label: "wire", source: "human" },
  { id: "y", type: "polyline", points: [[0, 0], [5, 5], [9, 1]], label: "conduit", source: "engine" },
  { id: "g", type: "polygon", points: [[0, 0], [9, 0], [9, 9]], label: "slab", source: "human" },
  { id: "c", type: "circle", points: [[0, 0], [8, 8]], label: "pad", source: "engine" },
];
const every = shapes.map((s) => s.id);
const optionalAll = (state) => annotationReducer(state, { type: "SET_OPTIONAL_MANY", ids: every, optional: true });

test("one action marks a selection of every shape optional", () => {
  const next = optionalAll(shapes);
  assert.equal(next.length, shapes.length);
  for (const a of next) assert.equal(a.optional, true);
  assert.equal(allOptional(next, every), true);
});

test("not optional again removes the key, and an untouched mark keeps its identity", () => {
  const marked = annotationReducer(shapes, { type: "SET_OPTIONAL_MANY", ids: ["p", "b"], optional: true });
  assert.equal(marked[2], shapes[2]);
  const cleared = annotationReducer(marked, { type: "SET_OPTIONAL_MANY", ids: ["p", "b"], optional: false });
  assert.deepEqual(cleared, shapes);
  assert.equal("optional" in cleared[0], false);
});

test("allOptional is false for a mixed selection and for an empty one", () => {
  const marked = annotationReducer(shapes, { type: "SET_OPTIONAL_MANY", ids: ["p"], optional: true });
  assert.equal(allOptional(marked, ["p", "b"]), false);
  assert.equal(allOptional(marked, ["p"]), true);
  assert.equal(allOptional(marked, []), false);
});

test("relabel, bulk relabel, regroup and move keep the flag", () => {
  let state = optionalAll(shapes);
  state = annotationReducer(state, { type: "RELABEL_MANY", ids: every, label: "other" });
  state = annotationReducer(state, { type: "SET_GROUP_MANY", ids: every, group: "g2" });
  state = annotationReducer(state, { type: "CLEAR_GROUP", group: "g2" });
  state = annotationReducer(state, { type: "MOVE_MANY", ids: every, delta: [3, 4] });
  state = annotationReducer(state, { type: "MOVE", id: "p", delta: [1, 1] });
  for (const a of state) assert.equal(a.optional, true, a.id);
});

test("the flag leaves group, label, source and confidence alone", () => {
  const next = optionalAll(shapes);
  next.forEach((a, i) => {
    const { optional: _o, ...rest } = a;
    assert.deepEqual(rest, shapes[i]);
  });
});
