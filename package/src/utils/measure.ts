import type { CanonicalAnnotation } from "../types/canonical";
import {
  annotationPixelArea,
  annotationPixelPerimeter,
  isAreaAnnotation,
} from "./booleanOps";
import {
  realAreaFromPixels,
  realLengthFromPixels,
  type DrawingScaleInput,
} from "./dimensions";

/**
 * Scale context needed to convert pixel geometry to real-world units.
 * Pass the same `dpi` / `drawingScale` you give `<AnnotationCanvas />`.
 */
export interface MeasureOptions {
  dpi?: number;
  drawingScale?: DrawingScaleInput;
}

/** A real-world measurement. `unit` is bare (`"m"`); `text` is display-ready (`"2.40m²"`). */
export interface RealMeasurement {
  value: number;
  unit: string;
  text: string;
}

function toMeasurement(
  real: { value: number; unit: string } | null,
  squared: boolean,
): RealMeasurement | null {
  if (!real) return null;
  const rounded = real.value.toFixed(real.value < 10 ? 2 : 1);
  return {
    value: real.value,
    unit: real.unit,
    text: `${rounded}${real.unit}${squared ? "²" : ""}`,
  };
}

function area(ann: CanonicalAnnotation): number;
function area(ann: CanonicalAnnotation, options: MeasureOptions): RealMeasurement | null;
function area(
  ann: CanonicalAnnotation,
  options?: MeasureOptions,
): number | RealMeasurement | null {
  const pixels = annotationPixelArea(ann);
  if (!options) return pixels;
  return toMeasurement(
    realAreaFromPixels(pixels, options.dpi, options.drawingScale),
    true,
  );
}

function perimeter(ann: CanonicalAnnotation): number;
function perimeter(ann: CanonicalAnnotation, options: MeasureOptions): RealMeasurement | null;
function perimeter(
  ann: CanonicalAnnotation,
  options?: MeasureOptions,
): number | RealMeasurement | null {
  const pixels = annotationPixelPerimeter(ann);
  if (!options) return pixels;
  return toMeasurement(
    realLengthFromPixels(pixels, options.dpi, options.drawingScale),
    false,
  );
}

/**
 * Pure geometry readout for any annotation — no canvas, no React, no engine schema.
 *
 * Called with one argument every function returns image pixels. Called with a
 * `{ dpi, drawingScale }` context it returns a real-world `RealMeasurement`, or
 * `null` when the scale is not configured.
 *
 * ```ts
 * measure.area(ann);                              // 9600  (px²)
 * measure.perimeter(ann);                         // 400   (px)
 * measure.perimeter(ann, { dpi, drawingScale });  // { value: 6.2, unit: "m", text: "6.20m" }
 * ```
 *
 * `area` is 0 for open shapes (line, polyline, point). `perimeter` is the closed
 * boundary for bbox / polygon / circle — summing every ring, so a hollow shape
 * counts its hole — and the open path length for line / polyline.
 */
export const measure = {
  area,
  perimeter,
  /** True for shapes that enclose an area: bbox, polygon, circle. */
  isAreaShape(ann: CanonicalAnnotation): boolean {
    return isAreaAnnotation(ann);
  },
};
