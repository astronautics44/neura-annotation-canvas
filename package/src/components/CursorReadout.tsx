import React from "react";
import { useStoreValue, type ValueStore } from "./valueStore";

interface CursorReadoutProps {
  cursor: ValueStore<readonly [number, number]>;
}

/**
 * The status bar's image coordinates under the pointer. Its own component so a
 * mousemove re-renders these two numbers and nothing else: it used to be state
 * on the canvas, and every pointer movement was a render of every shape.
 */
export function CursorReadout({ cursor }: CursorReadoutProps) {
  const [x, y] = useStoreValue(cursor);
  return (
    <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>x: {Math.round(x)} y: {Math.round(y)}</span>
  );
}
