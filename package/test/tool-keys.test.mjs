// A key reaches only the tools the consumer offered. Runs against the compiled
// package, so build first: `npm run build --workspace=package`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toolForKey } from "../dist/components/canvasHelpers.js";

test("with no subset every drawing key works, in either case", () => {
  assert.equal(toolForKey("b"), "bbox");
  assert.equal(toolForKey("T"), "count");
});

test("a tool left out of the subset has no key", () => {
  assert.equal(toolForKey("b", ["select", "comment"]), undefined);
  assert.equal(toolForKey("c", ["select", "comment"]), undefined);
});

test("a tool in the subset keeps its key", () => {
  assert.equal(toolForKey("l", ["select", "line"]), "line");
});

test("a key that is no tool's answers nothing", () => {
  assert.equal(toolForKey("z"), undefined);
});
