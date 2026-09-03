import React from "react";
import { Group } from "react-konva";
import { SCREEN_SPACE_NAME, SCREEN_UNITS_ATTR } from "./viewport";

interface ScreenSpaceProps {
  /** Anchor, in image pixels. */
  x: number;
  y: number;
  /** The stage scale React last rendered with. */
  scale: number;
  /** Screen pixels per child unit. 1 unless the children are drawn in some other unit. */
  units?: number;
  listening?: boolean;
  children: React.ReactNode;
}

/**
 * A group whose children are sized in screen pixels.
 *
 * Anything that must stay the same size at every zoom — a count mark, a
 * handle, a chip, a comment bubble — used to divide every dimension by the
 * stage scale, which put the scale into hundreds of props and made every
 * zoom tick a render of every shape. Here the group is counter-scaled once,
 * the children are written in plain pixels, and `paintViewport` keeps the
 * counter-scale current between React renders by its Konva name.
 */
export function ScreenSpace({ x, y, scale, units = 1, listening = true, children }: ScreenSpaceProps) {
  const k = units / scale;
  const attrs = { [SCREEN_UNITS_ATTR]: units };
  return (
    <Group x={x} y={y} name={SCREEN_SPACE_NAME} scaleX={k} scaleY={k} listening={listening} {...attrs}>
      {children}
    </Group>
  );
}
