import { controlThrough, flattenPath } from "./curves";

export const geo = {
  quadToPoints(quad: [number, number][]): [[number, number], [number, number]] {
    return [
      [Math.min(...quad.map((p) => p[0])), Math.min(...quad.map((p) => p[1]))],
      [Math.max(...quad.map((p) => p[0])), Math.max(...quad.map((p) => p[1]))],
    ];
  },

  cocoBoxToPoints(
    box: [number, number, number, number],
  ): [[number, number], [number, number]] {
    const [x, y, w, h] = box;
    return [
      [x, y],
      [x + w, y + h],
    ];
  },

  yoloBoxToPoints(
    box: [number, number, number, number],
    imgW: number,
    imgH: number,
  ): [[number, number], [number, number]] {
    const [cx, cy, w, h] = box;
    return [
      [(cx - w / 2) * imgW, (cy - h / 2) * imgH],
      [(cx + w / 2) * imgW, (cy + h / 2) * imgH],
    ];
  },

  cocoSegToPoints(seg: number[]): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i < seg.length; i += 2) pts.push([seg[i]!, seg[i + 1]!]);
    return pts;
  },

  /**
   * A path with bends, as straight pieces: `points` and `curves` as a
   * `CanonicalAnnotation` carries them. Each bent segment becomes `steps`
   * pieces (default 24); a straight segment stays one. For a backend that
   * takes straight segments only.
   */
  flattenCurves(
    points: [number, number][],
    curves: ([number, number] | null)[] | undefined,
    steps?: number,
  ): [number, number][] {
    return flattenPath(points, curves, steps);
  },

  /**
   * The control point for a bend from `start` to `end` passing through
   * `through` at its middle: an engine that reports an arc as three points
   * becomes one `curves` entry.
   */
  curveThrough(
    start: [number, number],
    end: [number, number],
    through: [number, number],
  ): [number, number] {
    return controlThrough(start, end, through);
  },
};
