/** The bubble's interior at rest: opaque, so linework never shows through it. */
const PAPER = "#ffffff";

/**
 * A marker's interior and count colours.
 *
 * At rest the bubble is paper with its outline and count in the thread's
 * colour. The open thread's marker is inverted, filled with that colour and its
 * count in paper, so the one being read stands out from every other cue on the
 * sheet rather than differing only by a slightly thicker outline.
 */
export function markerColors(stroke: string, isSelected: boolean): { fill: string; count: string } {
  return isSelected ? { fill: stroke, count: PAPER } : { fill: PAPER, count: stroke };
}
