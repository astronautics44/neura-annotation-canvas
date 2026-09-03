import type { Stage } from "konva/lib/Stage";

/**
 * Where the image sits on the stage: one scale for both axes, and the image
 * origin's offset from the stage's, in screen pixels.
 */
export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export const INITIAL_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

/**
 * Konva `name` of a group whose children are laid out in screen pixels. The
 * group is counter-scaled by `screenUnits / stage scale`, so a circle of radius
 * 8 inside it is 8 screen pixels wide at any zoom.
 */
export const SCREEN_SPACE_NAME = "screen-space";
export const SCREEN_UNITS_ATTR = "screenUnits";

/**
 * How long after the last wheel or pan event the viewport is written into
 * React state. Long enough that a trackpad gesture, which delivers an event
 * every frame, never commits mid-flight; short enough that anything laid out
 * from React state catches up before anybody notices.
 */
export const VIEWPORT_SETTLE_MS = 100;

/**
 * Writes a viewport onto a mounted stage without a React render.
 *
 * The stage's transform and every screen-space group are set directly; the
 * caller draws. This is what a frame of a wheel or pan gesture costs: a few
 * hundred attribute writes and one layer draw, rather than a render of the
 * whole component tree. React is told where the viewport landed once the
 * gesture settles, and re-rendering with that value writes the same numbers
 * again, so the two never disagree for longer than the settle window.
 */
export function paintViewport(stage: Stage, viewport: Viewport): void {
  stage.scale({ x: viewport.scale, y: viewport.scale });
  stage.position({ x: viewport.x, y: viewport.y });
  for (const group of stage.find(`.${SCREEN_SPACE_NAME}`)) {
    const units = (group.getAttr(SCREEN_UNITS_ATTR) as number | undefined) ?? 1;
    const k = units / viewport.scale;
    group.scale({ x: k, y: k });
  }
}

export function screenToImage(viewport: Viewport, sx: number, sy: number): [number, number] {
  return [(sx - viewport.x) / viewport.scale, (sy - viewport.y) / viewport.scale];
}

export function imageToScreen(viewport: Viewport, pt: readonly [number, number]): { x: number; y: number } {
  return { x: pt[0] * viewport.scale + viewport.x, y: pt[1] * viewport.scale + viewport.y };
}
