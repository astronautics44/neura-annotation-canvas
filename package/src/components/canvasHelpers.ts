import type { CanonicalAnnotation } from "../types/canonical";

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function bboxToKonva(pts: [number, number][]): { x: number; y: number; w: number; h: number } {
  const x1 = pts[0]![0], y1 = pts[0]![1], x2 = pts[1]![0], y2 = pts[1]![1];
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/** Axis-aligned bounds of any annotation in image pixel space. */
export function getAnnotationBounds(ann: CanonicalAnnotation): { x: number; y: number; w: number; h: number } {
  if (ann.type === "point") {
    const [x, y] = ann.points[0]!;
    const r = 8;
    return { x: x - r, y: y - r, w: r * 2, h: r * 2 };
  }
  if (ann.type === "line" && ann.points.length >= 2) {
    return bboxToKonva([ann.points[0]!, ann.points[1]!]);
  }
  if (ann.type === "bbox" || ann.type === "circle") {
    return bboxToKonva(ann.points);
  }
  if (ann.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = ann.points.map((p) => p[0]);
  const ys = ann.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function boxesIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function screenToImage(sx: number, sy: number, stageX: number, stageY: number, scale: number): [number, number] {
  return [(sx - stageX) / scale, (sy - stageY) / scale];
}

/** Closest point to `p` lying on segment [a, b], clamped to the segment. */
export function nearestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * dx, a[1] + t * dy];
}

export function centroid(pts: [number, number][]): [number, number] {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

export function bboxHandles(x: number, y: number, w: number, h: number) {
  return [
    { pos: [x, y] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0] + dx, p[0]![1] + dy] as [number, number], p[1]!] },
    { pos: [x + w / 2, y] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0], p[0]![1] + dy] as [number, number], p[1]!] },
    { pos: [x + w, y] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0], p[0]![1] + dy] as [number, number], [p[1]![0] + dx, p[1]![1]] as [number, number]] },
    { pos: [x + w, y + h / 2] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [p[0]!, [p[1]![0] + dx, p[1]![1]] as [number, number]] },
    { pos: [x + w, y + h] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [p[0]!, [p[1]![0] + dx, p[1]![1] + dy] as [number, number]] },
    { pos: [x + w / 2, y + h] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [p[0]!, [p[1]![0], p[1]![1] + dy] as [number, number]] },
    { pos: [x, y + h] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0] + dx, p[0]![1]] as [number, number], [p[1]![0], p[1]![1] + dy] as [number, number]] },
    { pos: [x, y + h / 2] as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0] + dx, p[0]![1]] as [number, number], p[1]!] },
  ];
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "label";
}

export function annotationReducer(state: CanonicalAnnotation[], action: import("./canvasConstants").Action): CanonicalAnnotation[] {
  switch (action.type) {
    case "LOAD": return action.payload;
    case "ADD": return [...state, action.payload];
    case "ADD_MANY": return [...state, ...action.payload];
    case "UPDATE": return state.map((a) => (a.id === action.payload.id ? action.payload : a));
    case "DELETE": return state.filter((a) => a.id !== action.id);
    case "DELETE_MANY": return state.filter((a) => !action.ids.includes(a.id));
    case "MOVE": return state.map((a) =>
      a.id !== action.id ? a : {
        ...a,
        points: a.points.map(([x, y]) => [x + action.delta[0], y + action.delta[1]] as [number, number]),
      });
    case "MOVE_MANY": return state.map((a) =>
      !action.ids.includes(a.id) ? a : {
        ...a,
        points: a.points.map(([x, y]) => [x + action.delta[0], y + action.delta[1]] as [number, number]),
      });
    case "REPLACE_MANY": {
      const remaining = state.filter((a) => !action.removeIds.includes(a.id));
      return [...remaining, ...action.add];
    }
    case "REORDER": {
      const idx = state.findIndex((a) => a.id === action.id);
      if (idx === -1) return state;
      const next = [...state];
      if (action.direction === "forward" && idx < next.length - 1) {
        const tmp = next[idx]!;
        next[idx] = next[idx + 1]!;
        next[idx + 1] = tmp;
      } else if (action.direction === "backward" && idx > 0) {
        const tmp = next[idx]!;
        next[idx] = next[idx - 1]!;
        next[idx - 1] = tmp;
      }
      return next;
    }
    case "BRING_TO_TOP": {
      const idx = state.findIndex((a) => a.id === action.id);
      if (idx === -1 || idx === state.length - 1) return state;
      const next = [...state];
      const [item] = next.splice(idx, 1);
      next.push(item!);
      return next;
    }
  }
}
