// Curved segments: the bend math, and every edit keeping `curves` aligned with
// `points`. Runs against the compiled package, so build first:
// `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apexOf,
  bendSegment,
  controlThrough,
  curvesOf,
  flattenPath,
  insertVertex,
  moveVertex,
  pathBounds,
  pathLength,
  quadLength,
  quadPoint,
  removeVertex,
  withoutCurves,
} from "../dist/utils/curves.js";
import { annotationReducer } from "../dist/components/canvasHelpers.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const nearPt = (p, q, eps = 1e-6) => { near(p[0], q[0], eps); near(p[1], q[1], eps); };

const line = { id: "l", type: "line", points: [[0, 0], [100, 0]], label: "wall", source: "human" };
const poly = { id: "y", type: "polyline", points: [[0, 0], [100, 0], [100, 100]], label: "duct", source: "engine" };

test("a bend passes through the dragged point at its middle", () => {
  const bent = bendSegment(line, 0, [50, 40]);
  assert.equal(bent.curves.length, 1);
  nearPt(apexOf([0, 0], bent.curves[0], [100, 0]), [50, 40]);
  nearPt(quadPoint([0, 0], bent.curves[0], [100, 0], 0.5), [50, 40]);
  // Lopsided: dragged towards one end, the curve still runs through the pointer.
  const lean = bendSegment(line, 0, [80, 30]);
  nearPt(apexOf([0, 0], lean.curves[0], [100, 0]), [80, 30]);
});

test("straightening the last bend removes the key", () => {
  const bent = bendSegment(line, 0, [50, 40]);
  const straight = bendSegment(bent, 0, null);
  assert.equal("curves" in straight, false);
  assert.deepEqual(straight, line);
});

test("curves of the wrong length, on the wrong shape, or all straight are ignored", () => {
  assert.equal(curvesOf({ ...poly, curves: [[50, 20]] }), undefined);
  assert.equal(curvesOf({ ...poly, curves: [null, null] }), undefined);
  assert.equal(curvesOf({ id: "g", type: "polygon", points: [[0, 0], [9, 0], [9, 9]], curves: [[1, 1], null], label: "x", source: "human" }), undefined);
  assert.deepEqual(curvesOf({ ...poly, curves: [[50, 20], "junk"] }), [[50, 20], null]);
});

test("arc length is exact against a fine flattening", () => {
  const c = controlThrough([0, 0], [100, 0], [30, 45]);
  const fine = flattenPath([[0, 0], [100, 0]], [c], 20000);
  let flat = 0;
  for (let i = 1; i < fine.length; i++) flat += Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]);
  near(quadLength([0, 0], c, [100, 0]), flat, 1e-3);
  // A straight control point measures as the chord.
  near(quadLength([0, 0], [50, 0], [100, 0]), 100);
  // Mixed path: one bend plus one straight 100.
  const bent = bendSegment(poly, 0, [50, 20]);
  near(pathLength(bent.points, bent.curves), quadLength([0, 0], bent.curves[0], [100, 0]) + 100);
});

test("bounds take in the bulge", () => {
  const bent = bendSegment(line, 0, [50, -40]);
  const b = pathBounds(bent.points, bent.curves);
  near(b.y, -40);
  near(b.h, 40);
  near(b.w, 100);
});

test("splitting a bend keeps the same curve and lands on it", () => {
  const bent = bendSegment(line, 0, [50, 40]);
  // The handle sits on the apex, which is where an Alt-drag splits.
  const { ann: split, at } = insertVertex(bent, 0, [50, 40]);
  assert.equal(split.points.length, 3);
  assert.equal(split.curves.length, 2);
  nearPt(at, [50, 40], 1e-4);
  nearPt(split.points[1], at);
  // Every point of the original curve is still on one of the halves.
  const before = flattenPath(bent.points, bent.curves, 64);
  const after = flattenPath(split.points, split.curves, 32);
  nearPt(before[16], after[16], 1e-4);
  nearPt(before[48], after[48], 1e-4);
});

test("splitting a straight segment of a bent path adds a straight entry", () => {
  const bent = bendSegment(poly, 0, [50, 20]);
  const { ann: split } = insertVertex(bent, 1, [100, 50]);
  assert.deepEqual(split.points, [[0, 0], [100, 0], [100, 50], [100, 100]]);
  assert.equal(split.curves.length, 3);
  assert.deepEqual(split.curves[0], bent.curves[0]);
  assert.equal(split.curves[1], null);
  assert.equal(split.curves[2], null);
});

test("removing a vertex keeps the bends aligned", () => {
  const bent = bendSegment(bendSegment(poly, 0, [50, 20]), 1, [120, 50]);
  // Inner vertex: the two segments join into one straight one.
  assert.equal("curves" in removeVertex(bent, 1), false);
  // An endpoint takes its own segment's bend with it.
  const dropFirst = removeVertex(bent, 0);
  assert.deepEqual(dropFirst.points, [[100, 0], [100, 100]]);
  assert.deepEqual(dropFirst.curves, [bent.curves[1]]);
  const dropLast = removeVertex(bent, 2);
  assert.deepEqual(dropLast.curves, [bent.curves[0]]);
});

test("moving a vertex carries the bend with its segment", () => {
  const bent = bendSegment(line, 0, [50, 40]);
  // Doubling the segment doubles the bow.
  const longer = moveVertex(bent, 1, [200, 0]);
  nearPt(apexOf(longer.points[0], longer.curves[0], longer.points[1]), [100, 80]);
  // Turning it through 90° turns the bow with it.
  const turned = moveVertex(bent, 1, [0, 100]);
  nearPt(apexOf(turned.points[0], turned.curves[0], turned.points[1]), [-40, 50]);
});

test("moving and duplicating an annotation moves its control points", () => {
  const bent = bendSegment(poly, 0, [50, 20]);
  const [moved] = annotationReducer([bent], { type: "MOVE", id: "y", delta: [10, 5] });
  assert.deepEqual(moved.points[0], [10, 5]);
  nearPt(moved.curves[0], [bent.curves[0][0] + 10, bent.curves[0][1] + 5]);
  assert.equal(moved.curves[1], null);
  const [many] = annotationReducer([bent], { type: "MOVE_MANY", ids: ["y"], delta: [-1, -1] });
  nearPt(many.curves[0], [bent.curves[0][0] - 1, bent.curves[0][1] - 1]);
  // A mark without curves gains no key.
  const [plain] = annotationReducer([line], { type: "MOVE", id: "l", delta: [1, 1] });
  assert.equal("curves" in plain, false);
});

test("without curves strips the key and leaves a plain mark alone", () => {
  const bent = bendSegment(line, 0, [50, 40]);
  assert.equal("curves" in withoutCurves(bent), false);
  assert.equal(withoutCurves(line), line);
});
