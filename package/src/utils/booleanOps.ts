import { union, difference, intersection } from "polygon-clipping";
import type { CanonicalAnnotation } from "../types/canonical";

type Ring = [number, number][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

export type BooleanOp = "union" | "subtract" | "intersect";

export interface ShapeMeta {
  hollow?: boolean;
  /** First ring is outer boundary; additional rings are holes (even-odd fill). */
  rings?: [number, number][][];
  booleanOp?: BooleanOp;
  operandIds?: string[];
}

const AREA_TYPES = new Set(["bbox", "polygon", "circle"]);

export function isAreaAnnotation(ann: CanonicalAnnotation): boolean {
  return AREA_TYPES.has(ann.type);
}

function bboxToKonva(pts: [number, number][]): { x: number; y: number; w: number; h: number } {
  const x1 = pts[0]![0], y1 = pts[0]![1], x2 = pts[1]![0], y2 = pts[1]![1];
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function closeRing(ring: Ring): Ring {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function bboxRing(pts: [number, number][]): Ring {
  const { x, y, w, h } = bboxToKonva(pts);
  return closeRing([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
}

function circleRing(pts: [number, number][], segments = 64): Ring {
  const { x, y, w } = bboxToKonva(pts);
  const cx = x + w / 2;
  const cy = y + w / 2;
  const r = w / 2;
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    ring.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return closeRing(ring);
}

function polygonRing(ann: CanonicalAnnotation): Ring {
  const meta = ann.meta as ShapeMeta | undefined;
  if (meta?.rings?.[0]?.length) return closeRing(meta.rings[0] as Ring);
  return closeRing(ann.points as Ring);
}

/** Convert an area annotation to a polygon-clipping MultiPolygon. */
export function annotationToMultiPolygon(ann: CanonicalAnnotation): MultiPolygon {
  if (!isAreaAnnotation(ann)) return [];

  const meta = ann.meta as ShapeMeta | undefined;
  if (meta?.rings && meta.rings.length > 0) {
    return [meta.rings.map((r) => closeRing(r as Ring))];
  }

  let ring: Ring;
  if (ann.type === "bbox") ring = bboxRing(ann.points);
  else if (ann.type === "circle") ring = circleRing(ann.points);
  else ring = polygonRing(ann);

  return [[ring]];
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area / 2);
}

function polygonToRings(poly: Polygon): [number, number][][] {
  return poly.map((ring) => {
    const closed = closeRing(ring);
    if (closed.length > 1) {
      const first = closed[0]!;
      const last = closed[closed.length - 1]!;
      if (first[0] === last[0] && first[1] === last[1]) return closed.slice(0, -1);
    }
    return closed;
  });
}

function openRing(ring: Ring): [number, number][] {
  const closed = closeRing(ring);
  if (closed.length <= 1) return closed;
  const first = closed[0]!;
  const last = closed[closed.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return closed.slice(0, -1);
  return closed;
}

function multiPolygonToAnnotations(
  mp: MultiPolygon,
  template: CanonicalAnnotation,
  op: BooleanOp,
  operandIds: string[],
): CanonicalAnnotation[] {
  const results: CanonicalAnnotation[] = [];

  for (const poly of mp) {
    if (!poly.length || !poly[0]?.length) continue;
    const rings = polygonToRings(poly);
    const outer = rings[0];
    if (!outer || outer.length < 3) continue;

    results.push({
      ...template,
      id: template.id,
      type: "polygon",
      points: outer as [number, number][],
      source: "human",
      meta: {
        ...(template.meta ?? {}),
        rings,
        booleanOp: op,
        operandIds,
        hollow: (template.meta as ShapeMeta | undefined)?.hollow,
      },
    });
  }

  return results;
}

export function mergeAnnotations(
  annotations: CanonicalAnnotation[],
  newId: () => string,
): CanonicalAnnotation[] {
  const area = annotations.filter(isAreaAnnotation);
  if (area.length < 2) return [];

  const mpList = area.map(annotationToMultiPolygon).filter((m) => m.length);
  if (mpList.length < 2) return [];

  let acc = mpList[0]!;
  for (let i = 1; i < mpList.length; i++) {
    acc = union(acc, mpList[i]!) as MultiPolygon;
  }

  if (!acc.length) return [];

  const template = { ...area[0]!, id: newId() };
  return multiPolygonToAnnotations(acc, template, "union", area.map((a) => a.id)).map((a, i) => ({
    ...a,
    id: i === 0 ? template.id : newId(),
  }));
}

/** First selected shape minus all others. */
export function subtractAnnotations(
  annotations: CanonicalAnnotation[],
  newId: () => string,
): CanonicalAnnotation[] {
  const area = annotations.filter(isAreaAnnotation);
  if (area.length < 2) return [];

  let acc = annotationToMultiPolygon(area[0]!);
  for (let i = 1; i < area.length; i++) {
    acc = difference(acc, annotationToMultiPolygon(area[i]!)) as MultiPolygon;
  }

  if (!acc.length) return [];

  const template = { ...area[0]!, id: newId() };
  return multiPolygonToAnnotations(acc, template, "subtract", area.map((a) => a.id)).map((a, i) => ({
    ...a,
    id: i === 0 ? template.id : newId(),
  }));
}

/** Overlap region of all selected shapes. */
export function intersectAnnotations(
  annotations: CanonicalAnnotation[],
  newId: () => string,
): CanonicalAnnotation[] {
  const area = annotations.filter(isAreaAnnotation);
  if (area.length < 2) return [];

  let acc = annotationToMultiPolygon(area[0]!);
  for (let i = 1; i < area.length; i++) {
    acc = intersection(acc, annotationToMultiPolygon(area[i]!)) as MultiPolygon;
  }

  if (!acc.length) return [];

  const template = { ...area[0]!, id: newId() };
  return multiPolygonToAnnotations(acc, template, "intersect", area.map((a) => a.id)).map((a, i) => ({
    ...a,
    id: i === 0 ? template.id : newId(),
  }));
}

/** Cut the smaller shape out of the larger — produces a hollow ring (donut). */
export function hollowAnnotations(
  annotations: CanonicalAnnotation[],
  newId: () => string,
): CanonicalAnnotation[] {
  const area = annotations.filter(isAreaAnnotation);
  if (area.length !== 2) return [];

  const [a, b] = area;
  const mpA = annotationToMultiPolygon(a!);
  const mpB = annotationToMultiPolygon(b!);
  const areaA = mpA[0]?.[0] ? ringArea(mpA[0][0]) : 0;
  const areaB = mpB[0]?.[0] ? ringArea(mpB[0][0]) : 0;

  const outerAnn = areaA >= areaB ? a! : b!;
  const innerAnn = areaA >= areaB ? b! : a!;
  const outer = openRing(polygonRing(outerAnn));
  const inner = openRing(polygonRing(innerAnn));

  if (outer.length < 3 || inner.length < 3) return [];

  const template = { ...outerAnn, id: newId() };
  return [{
    ...template,
    type: "polygon",
    points: outer as [number, number][],
    source: "human",
    meta: {
      ...(template.meta ?? {}),
      hollow: false,
      rings: [outer, inner],
      booleanOp: "subtract",
      operandIds: [a!.id, b!.id],
    },
  }];
}

export function toggleHollow(ann: CanonicalAnnotation): CanonicalAnnotation {
  const meta = (ann.meta ?? {}) as ShapeMeta;
  return {
    ...ann,
    meta: { ...meta, hollow: !meta.hollow },
  };
}

export function getAnnotationRings(ann: CanonicalAnnotation): [number, number][][] {
  const meta = ann.meta as ShapeMeta | undefined;
  if (meta?.rings?.length) return meta.rings;
  if (ann.type === "bbox") return [openRing(bboxRing(ann.points))];
  if (ann.type === "circle") return [openRing(circleRing(ann.points))];
  if (ann.type === "polygon") return [ann.points];
  return [];
}
