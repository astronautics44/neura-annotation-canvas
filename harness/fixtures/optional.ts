import type { AnnotationGroup, CanonicalAnnotation } from "@astronautics44/neura-annotation-canvas";

/**
 * Every annotation type twice, once solid and once optional, with one optional
 * mark and one solid mark in the same group. What `enableOptional` has to draw
 * dashed, side by side with what it must leave alone.
 */
export const optionalGroups: AnnotationGroup[] = [
  { id: "optional-group-kitchen", name: "Kitchen", color: "#E879F9" },
];

const ROW_SOLID = 1200;
const ROW_OPTIONAL = 2400;

function pair(
  id: string,
  type: CanonicalAnnotation["type"],
  label: string,
  at: (y: number) => [number, number][],
): CanonicalAnnotation[] {
  return [
    { id: `${id}-solid`, type, label, points: at(ROW_SOLID), source: "engine", confidence: 0.9 },
    { id: `${id}-optional`, type, label, points: at(ROW_OPTIONAL), source: "engine", confidence: 0.9, optional: true },
  ];
}

export function optionalAnnotations(): CanonicalAnnotation[] {
  const marks = [
    ...pair("point", "point", "column", (y) => [[800, y]]),
    ...pair("bbox", "bbox", "door", (y) => [[1400, y - 200], [1900, y + 200]]),
    ...pair("circle", "circle", "room", (y) => [[2300, y - 250], [2800, y + 250]]),
    ...pair("line", "line", "pipe", (y) => [[3200, y - 200], [3800, y + 200]]),
    ...pair("polyline", "polyline", "pipe", (y) => [[4200, y], [4600, y - 300], [5000, y + 100], [5400, y - 100]]),
    ...pair("polygon", "polygon", "wall", (y) => [[5800, y - 250], [6500, y - 250], [6700, y + 250], [5700, y + 250]]),
  ];
  return marks.map((mark) =>
    mark.id === "bbox-solid" || mark.id === "bbox-optional"
      ? { ...mark, group: "optional-group-kitchen" }
      : mark,
  );
}
