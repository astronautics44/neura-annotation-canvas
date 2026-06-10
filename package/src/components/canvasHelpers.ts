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

export function screenToImage(sx: number, sy: number, stageX: number, stageY: number, scale: number): [number, number] {
  return [(sx - stageX) / scale, (sy - stageY) / scale];
}

export function centroid(pts: [number, number][]): [number, number] {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

export function bboxHandles(x: number, y: number, w: number, h: number) {
  return [
    { pos: [x, y]           as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0]+dx, p[0]![1]+dy] as [number, number], p[1]!] },
    { pos: [x+w/2, y]       as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0], p[0]![1]+dy] as [number, number], p[1]!] },
    { pos: [x+w, y]         as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0], p[0]![1]+dy] as [number, number], [p[1]![0]+dx, p[1]![1]] as [number, number]] },
    { pos: [x+w, y+h/2]     as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [p[0]!, [p[1]![0]+dx, p[1]![1]] as [number, number]] },
    { pos: [x+w, y+h]       as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [p[0]!, [p[1]![0]+dx, p[1]![1]+dy] as [number, number]] },
    { pos: [x+w/2, y+h]     as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [p[0]!, [p[1]![0], p[1]![1]+dy] as [number, number]] },
    { pos: [x, y+h]         as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0]+dx, p[0]![1]] as [number, number], [p[1]![0], p[1]![1]+dy] as [number, number]] },
    { pos: [x, y+h/2]       as [number, number], resizeFn: (dx: number, dy: number, p: [number, number][]) => [[p[0]![0]+dx, p[0]![1]] as [number, number], p[1]!] },
  ];
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "label";
}

export function annotationReducer(state: CanonicalAnnotation[], action: import("./canvasConstants").Action): CanonicalAnnotation[] {
  switch (action.type) {
    case "LOAD":        return action.payload;
    case "ADD":         return [...state, action.payload];
    case "ADD_MANY":    return [...state, ...action.payload];
    case "UPDATE":      return state.map((a) => (a.id === action.payload.id ? action.payload : a));
    case "DELETE":      return state.filter((a) => a.id !== action.id);
    case "DELETE_MANY": return state.filter((a) => !action.ids.includes(a.id));
    case "MOVE":        return state.map((a) =>
      a.id !== action.id ? a : {
        ...a,
        points: a.points.map(([x, y]) => [x + action.delta[0], y + action.delta[1]] as [number, number]),
      });
    case "MOVE_MANY":   return state.map((a) =>
      !action.ids.includes(a.id) ? a : {
        ...a,
        points: a.points.map(([x, y]) => [x + action.delta[0], y + action.delta[1]] as [number, number]),
      });
  }
}
