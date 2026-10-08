import type { CanonicalAnnotation } from "../types/canonical";

/**
 * Curved segments on a line or polyline. Pure math, no Konva.
 *
 * A bent segment is a quadratic Bézier from `points[i]` to `points[i + 1]`
 * whose control point is `curves[i]`, in image pixels like every other
 * coordinate. A quadratic bends one way only, so a segment is a single bow and
 * never a wave. The handle the user drags is the curve's apex, the point at
 * t = 0.5, which is where the control point pulls hardest:
 *
 *   apex    = (a + 2c + b) / 4
 *   control = 2·apex − (a + b) / 2
 */

export type Pt = [number, number];
export type Curves = (Pt | null)[];

/** How many points stand for one bent segment when it is drawn as straight pieces. */
const DEFAULT_FLATTEN_STEPS = 24;
/** Samples taken to find the parameter nearest a point before refining it. */
const NEAREST_SAMPLES = 32;
const NEAREST_REFINE_STEPS = 48;

function isPt(value: unknown): value is Pt {
  return Array.isArray(value) && value.length === 2
    && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

/** True for the two shapes a bend applies to. */
export function isCurvable(ann: CanonicalAnnotation): boolean {
  return ann.type === "line" || ann.type === "polyline";
}

/**
 * The bends of a line or polyline, one per segment, or undefined when it has
 * none. A `curves` array of the wrong length, or on any other shape, is
 * ignored as a whole: a half-applied list would bend the wrong segments.
 */
export function curvesOf(ann: CanonicalAnnotation): Curves | undefined {
  if (!isCurvable(ann)) return undefined;
  const curves = ann.curves;
  if (!Array.isArray(curves) || curves.length !== ann.points.length - 1) return undefined;
  const clean = curves.map((c) => (isPt(c) ? ([c[0], c[1]] as Pt) : null));
  return clean.some((c) => c !== null) ? clean : undefined;
}

/** The annotation with `curves` set, or the key removed when nothing is bent. */
export function withCurves(ann: CanonicalAnnotation, curves: Curves | undefined): CanonicalAnnotation {
  const { curves: _drop, ...rest } = ann;
  if (!curves || curves.every((c) => c === null)) return rest;
  return { ...rest, curves };
}

export function quadPoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
  ];
}

/** The point at t = 0.5, where the bend handle sits. */
export function apexOf(a: Pt, c: Pt, b: Pt): Pt {
  return [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];
}

/** The control point whose curve passes through `apex` at t = 0.5. */
export function controlThrough(a: Pt, b: Pt, apex: Pt): Pt {
  return [2 * apex[0] - (a[0] + b[0]) / 2, 2 * apex[1] - (a[1] + b[1]) / 2];
}

/** Where segment `i`'s handle sits: the apex of a bend, or the chord's midpoint. */
export function segmentHandle(a: Pt, b: Pt, c: Pt | null): Pt {
  return c ? apexOf(a, c, b) : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Distance from `p` to the infinite line through a and b. */
export function distanceToChord(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / len;
}

/**
 * Exact arc length of a quadratic Bézier, in closed form. Falls back to the
 * chord when the control point sits on it, where the formula divides by zero.
 */
export function quadLength(a: Pt, c: Pt, b: Pt): number {
  const ax = a[0] - 2 * c[0] + b[0], ay = a[1] - 2 * c[1] + b[1];
  const bx = 2 * (c[0] - a[0]), by = 2 * (c[1] - a[1]);
  const A = 4 * (ax * ax + ay * ay);
  const B = 4 * (ax * bx + ay * by);
  const C = bx * bx + by * by;
  if (A < 1e-12) return Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sabc = 2 * Math.sqrt(A + B + C);
  const a2 = Math.sqrt(A);
  const a32 = 2 * A * a2;
  const c2 = 2 * Math.sqrt(C);
  const ba = B / a2;
  const disc = 4 * C * A - B * B;
  const logArg = (2 * a2 + ba + sabc) / (ba + c2);
  // A straight-but-folded curve (control beyond an endpoint, on the chord's
  // line) has a zero discriminant and a log argument that can go non-positive.
  if (!(logArg > 0) || Math.abs(disc) < 1e-9) return flattenedLength(a, c, b);
  return (a32 * sabc + a2 * B * (sabc - c2) + disc * Math.log(logArg)) / (4 * a32);
}

function flattenedLength(a: Pt, c: Pt, b: Pt): number {
  let length = 0;
  let prev = a;
  const steps = 256;
  for (let i = 1; i <= steps; i++) {
    const p = quadPoint(a, c, b, i / steps);
    length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return length;
}

/** Axis-aligned bounds of a quadratic Bézier: its endpoints and any turning point. */
export function quadBounds(a: Pt, c: Pt, b: Pt): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = [a[0], b[0]], ys = [a[1], b[1]];
  for (const axis of [0, 1] as const) {
    const denom = a[axis] - 2 * c[axis] + b[axis];
    if (denom === 0) continue;
    const t = (a[axis] - c[axis]) / denom;
    if (t > 0 && t < 1) {
      const p = quadPoint(a, c, b, t);
      xs.push(p[0]); ys.push(p[1]);
    }
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** De Casteljau split at t: the two halves' control points and the shared point. */
export function splitQuad(a: Pt, c: Pt, b: Pt, t: number): { left: Pt; mid: Pt; right: Pt } {
  const left: Pt = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  const right: Pt = [c[0] + (b[0] - c[0]) * t, c[1] + (b[1] - c[1]) * t];
  const mid: Pt = [left[0] + (right[0] - left[0]) * t, left[1] + (right[1] - left[1]) * t];
  return { left, mid, right };
}

/** The parameter on the curve nearest `p`. */
export function nearestT(a: Pt, c: Pt, b: Pt, p: Pt): number {
  const dist = (t: number) => {
    const q = quadPoint(a, c, b, t);
    return (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
  };
  let best = 0, bestD = Infinity;
  for (let i = 0; i <= NEAREST_SAMPLES; i++) {
    const t = i / NEAREST_SAMPLES;
    const d = dist(t);
    if (d < bestD) { bestD = d; best = t; }
  }
  let lo = Math.max(0, best - 1 / NEAREST_SAMPLES), hi = Math.min(1, best + 1 / NEAREST_SAMPLES);
  for (let i = 0; i < NEAREST_REFINE_STEPS; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (dist(m1) < dist(m2)) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}

/** Points along one segment, straight or bent, endpoints included. */
export function segmentPoints(a: Pt, b: Pt, c: Pt | null, steps = DEFAULT_FLATTEN_STEPS): Pt[] {
  if (!c) return [a, b];
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) out.push(quadPoint(a, c, b, i / steps));
  return out;
}

/**
 * A path with bends, as straight pieces. Each bent segment becomes
 * `steps` pieces; a straight one stays one.
 */
export function flattenPath(points: readonly Pt[], curves: readonly (Pt | null)[] | undefined, steps = DEFAULT_FLATTEN_STEPS): Pt[] {
  if (points.length === 0) return [];
  const out: Pt[] = [points[0]!];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = segmentPoints(points[i]!, points[i + 1]!, curves?.[i] ?? null, steps);
    out.push(...seg.slice(1));
  }
  return out;
}

/** Open path length with bends measured along the curve. */
export function pathLength(points: readonly Pt[], curves: readonly (Pt | null)[] | undefined): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!, c = curves?.[i] ?? null;
    length += c ? quadLength(a, c, b) : Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return length;
}

/** Bounds of a path, its bends included. */
export function pathBounds(points: readonly Pt[], curves: readonly (Pt | null)[] | undefined): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
    const c = curves?.[i];
    const next = points[i + 1];
    if (c && next) {
      const q = quadBounds(p, c, next);
      minX = Math.min(minX, q.minX); minY = Math.min(minY, q.minY);
      maxX = Math.max(maxX, q.maxX); maxY = Math.max(maxY, q.maxY);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Where a control point lands when its segment's endpoints move from (a, b) to
 * (a2, b2): the same place in the segment's own frame, so the bend keeps its
 * shape and stretches, turns and scales with the segment.
 */
export function carryControl(a: Pt, b: Pt, c: Pt, a2: Pt, b2: Pt): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return [c[0] + a2[0] - a[0], c[1] + a2[1] - a[1]];
  const rx = c[0] - a[0], ry = c[1] - a[1];
  const along = (rx * dx + ry * dy) / lenSq;
  const across = (dx * ry - dy * rx) / lenSq;
  const dx2 = b2[0] - a2[0], dy2 = b2[1] - a2[1];
  return [a2[0] + along * dx2 - across * dy2, a2[1] + along * dy2 + across * dx2];
}

/**
 * Vertex `index` moved to `to`. The bends on either side keep their shape
 * relative to their own segment.
 */
export function moveVertex(ann: CanonicalAnnotation, index: number, to: Pt): CanonicalAnnotation {
  const points = ann.points.map((p, i) => (i === index ? to : p)) as Pt[];
  const curves = curvesOf(ann);
  if (!curves) return { ...ann, points };
  const next = curves.map((c, i) => {
    if (!c || (i !== index && i !== index - 1)) return c;
    return carryControl(ann.points[i]!, ann.points[i + 1]!, c, points[i]!, points[i + 1]!);
  });
  return withCurves({ ...ann, points }, next);
}

/**
 * A vertex inserted on segment `segIdx` at `pos`. A bent segment is split at
 * the point on the curve nearest `pos` into two bends that trace exactly the
 * same path; the new vertex lands on the curve, not on the chord.
 * Returns the annotation and where the new vertex actually went.
 */
export function insertVertex(ann: CanonicalAnnotation, segIdx: number, pos: Pt): { ann: CanonicalAnnotation; at: Pt } {
  const curves = curvesOf(ann);
  const a = ann.points[segIdx]!, b = ann.points[segIdx + 1]!;
  const c = curves?.[segIdx] ?? null;
  const points = [...ann.points] as Pt[];
  if (!curves || !c) {
    points.splice(segIdx + 1, 0, pos);
    const next = curves ? [...curves.slice(0, segIdx + 1), null, ...curves.slice(segIdx + 1)] : undefined;
    return { ann: withCurves({ ...ann, points }, next), at: pos };
  }
  const { left, mid, right } = splitQuad(a, c, b, nearestT(a, c, b, pos));
  points.splice(segIdx + 1, 0, mid);
  const next = [...curves.slice(0, segIdx), left, right, ...curves.slice(segIdx + 1)];
  return { ann: withCurves({ ...ann, points }, next), at: mid };
}

/**
 * Vertex `index` removed from an open path. An endpoint takes its one segment
 * with it; an inner vertex joins its two segments into one straight one.
 */
export function removeVertex(ann: CanonicalAnnotation, index: number): CanonicalAnnotation {
  const points = ann.points.filter((_, i) => i !== index) as Pt[];
  const curves = curvesOf(ann);
  if (!curves) return withCurves({ ...ann, points }, undefined);
  let next: Curves;
  if (index === 0) next = curves.slice(1);
  else if (index === ann.points.length - 1) next = curves.slice(0, -1);
  else next = [...curves.slice(0, index - 1), null, ...curves.slice(index + 1)];
  return withCurves({ ...ann, points }, next);
}

/**
 * Segment `segIdx` bent so it passes through `apex`, or straightened when
 * `apex` is null.
 */
export function bendSegment(ann: CanonicalAnnotation, segIdx: number, apex: Pt | null): CanonicalAnnotation {
  const segCount = ann.points.length - 1;
  const curves: Curves = curvesOf(ann) ?? Array.from({ length: segCount }, () => null);
  const a = ann.points[segIdx]!, b = ann.points[segIdx + 1]!;
  const next = curves.map((c, i) => (i === segIdx ? (apex ? controlThrough(a, b, apex) : null) : c));
  return withCurves(ann, next);
}

/** The annotation with its bends removed, for a canvas that does not draw them. */
export function withoutCurves(ann: CanonicalAnnotation): CanonicalAnnotation {
  if (ann.curves === undefined) return ann;
  const { curves: _drop, ...rest } = ann;
  return rest;
}
