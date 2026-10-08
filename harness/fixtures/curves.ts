import { geo } from "@astronautics44/neura-annotation-canvas/geo";
import type { CanonicalAnnotation } from "@astronautics44/neura-annotation-canvas";

/**
 * Lines and polylines for `enableCurves`: two straight ones to bend by hand,
 * and three that arrive bent. The bent ones show both ways a client adapter
 * can produce `curves`: a control point straight from the engine, or an arc
 * reported as start / middle / end through `geo.curveThrough`.
 */
export function curveAnnotations(): CanonicalAnnotation[] {
  return [
    // Straight, to bend: a line and a three-segment polyline.
    { id: "curve-line", type: "line", label: "wall", source: "human",
      points: [[900, 900], [2100, 900]] },
    { id: "curve-polyline", type: "polyline", label: "pipe", source: "engine", confidence: 0.88,
      points: [[2700, 700], [3500, 1100], [4300, 700], [5100, 1100]] },

    // A door swing: one quarter bow from the hinge's two ends, through its middle.
    { id: "curve-swing", type: "line", label: "door", source: "engine", confidence: 0.93,
      points: [[900, 2600], [1800, 1700]],
      curves: [geo.curveThrough([900, 2600], [1800, 1700], [1600, 2400])] },

    // A curved wall between two straight runs.
    { id: "curve-wall", type: "polyline", label: "wall", source: "engine", confidence: 0.81,
      points: [[2600, 2700], [3200, 2700], [4400, 2700], [5000, 2700]],
      curves: [null, [3800, 1900], null] },

    // Lopsided: the control point leans to one end, so the bow does too.
    { id: "curve-lean", type: "line", label: "pipe", source: "human",
      points: [[5600, 2700], [6800, 2700]],
      curves: [[6600, 1800]] },
  ];
}
