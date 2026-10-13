// The selected comment marker is inverted. Runs against the compiled package,
// so build first: `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { markerColors } from "../dist/components/markerColors.js";

test("a marker at rest is paper with its count in the thread's colour", () => {
  assert.deepEqual(markerColors("#e5484d", false), { fill: "#ffffff", count: "#e5484d" });
});

test("the selected marker is filled with the thread's colour and its count is paper", () => {
  assert.deepEqual(markerColors("#e5484d", true), { fill: "#e5484d", count: "#ffffff" });
});
