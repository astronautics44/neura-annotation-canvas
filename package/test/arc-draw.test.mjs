// PlanSwift's arc mode while drawing a line or polyline: `A`, then the arc's
// middle point, then its end. Runs against the compiled package, so build
// first: `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apexOf,
  clickPathDraft,
  previewControl,
  toggleArcDraft,
  undoPathDraft,
} from "../dist/utils/curves.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const nearPt = (p, q) => { near(p[0], q[0]); near(p[1], q[1]); };

const start = { pts: [[0, 0]], curves: [], arc: null };

test("straight clicks add straight segments", () => {
  const d = clickPathDraft(clickPathDraft(start, [100, 0]), [100, 100]);
  assert.deepEqual(d.pts, [[0, 0], [100, 0], [100, 100]]);
  assert.deepEqual(d.curves, [null, null]);
});

test("A, middle, end: an arc through all three clicks, then back to straight", () => {
  const armed = toggleArcDraft(start);
  assert.deepEqual(armed.arc, { mid: null });
  const withMid = clickPathDraft(armed, [50, 40]);
  // The middle click places no vertex.
  assert.deepEqual(withMid.pts, [[0, 0]]);
  assert.deepEqual(withMid.arc, { mid: [50, 40] });
  const done = clickPathDraft(withMid, [100, 0]);
  assert.deepEqual(done.pts, [[0, 0], [100, 0]]);
  assert.equal(done.arc, null);
  nearPt(apexOf([0, 0], done.curves[0], [100, 0]), [50, 40]);
  // The arc is spent: the next click is straight.
  const after = clickPathDraft(done, [200, 0]);
  assert.equal(after.curves[1], null);
});

test("an off-centre middle click still lies on the arc", () => {
  const d = clickPathDraft(clickPathDraft(toggleArcDraft(start), [80, 30]), [100, 0]);
  nearPt(apexOf([0, 0], d.curves[0], [100, 0]), [80, 30]);
});

test("the preview bends through the middle point to the pointer", () => {
  const withMid = clickPathDraft(toggleArcDraft(start), [50, 40]);
  nearPt(apexOf([0, 0], previewControl(withMid, [100, 0]), [100, 0]), [50, 40]);
  assert.equal(previewControl(toggleArcDraft(start), [100, 0]), null);
  assert.equal(previewControl(start, [100, 0]), null);
});

test("A again disarms the arc", () => {
  assert.equal(toggleArcDraft(toggleArcDraft(start)).arc, null);
});

test("undo takes back the middle point, then the arc, then the vertex", () => {
  const two = clickPathDraft(start, [100, 0]);
  const withMid = clickPathDraft(toggleArcDraft(two), [150, 40]);
  const noMid = undoPathDraft(withMid);
  assert.deepEqual(noMid.arc, { mid: null });
  const disarmed = undoPathDraft(noMid);
  assert.equal(disarmed.arc, null);
  const one = undoPathDraft(disarmed);
  assert.deepEqual(one.pts, [[0, 0]]);
  assert.deepEqual(one.curves, []);
  assert.equal(undoPathDraft(one), null);
});
