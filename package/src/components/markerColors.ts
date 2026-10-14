/**
 * A thread's outline colour: loud while open, the success colour once resolved.
 *
 * A resolved thread is never dimmed. It used to be drawn at half opacity in the
 * muted grey, which made it the one cue on a sheet that could not be found, and
 * somebody looking for an answered question has to be able to find it. The
 * colour and the check badge `CommentMarkers` draws on it tell the two apart.
 */
export function markerStroke(resolved: boolean, open: string, done: string): string {
  return resolved ? done : open;
}

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
