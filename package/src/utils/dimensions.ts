import type { CanonicalAnnotation } from "../types/canonical";
import { bboxToKonva } from "../components/canvasHelpers";
import { annotationPixelArea, annotationPixelPerimeter, isAreaAnnotation } from "./booleanOps";

export type DrawingScaleUnit = "mm" | "cm" | "m" | "in" | "ft";

export interface DrawingScaleInput {
  value: number;
  unit: DrawingScaleUnit;
}

export function getRealUnitsPerPixel(
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): number | null {
  if (!dpi || !drawingScale) return null;
  const isPaperInches = drawingScale.unit === "in" || drawingScale.unit === "ft";
  const realUnitsPerPaperInch = isPaperInches
    ? drawingScale.value
    : drawingScale.value * 25.4;
  return realUnitsPerPaperInch / dpi;
}

/** A real-world quantity after unit promotion. `unit` is bare (no `²`) — see `RealMeasurement.text`. */
export interface RealValue {
  value: number;
  unit: string;
}

function roundReal(val: number): string {
  return val.toFixed(val < 10 ? 2 : 1);
}

/** Real-world length from a pixel value + drawing scale. Null when scale is not configured. */
export function realLengthFromPixels(
  pixels: number,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): RealValue | null {
  const realUnitsPerPixel = getRealUnitsPerPixel(dpi, drawingScale);
  if (realUnitsPerPixel === null || !drawingScale) return null;
  let value = pixels * realUnitsPerPixel;
  let unit: string = drawingScale.unit;
  if (unit === "mm" && value >= 1000) { value /= 1000; unit = "m"; }
  else if (unit === "cm" && value >= 100) { value /= 100; unit = "m"; }
  else if (unit === "in" && value >= 12) { value /= 12; unit = "ft"; }
  return { value, unit };
}

/** Real-world area from a pixel² value + drawing scale. Null when scale is not configured. */
export function realAreaFromPixels(
  pixelArea: number,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): RealValue | null {
  const realUnitsPerPixel = getRealUnitsPerPixel(dpi, drawingScale);
  if (realUnitsPerPixel === null || !drawingScale) return null;
  let value = pixelArea * realUnitsPerPixel * realUnitsPerPixel;
  let unit: string = drawingScale.unit;
  // Same promotion thresholds as realLengthFromPixels, squared
  if (unit === "mm" && value >= 1_000_000) { value /= 1_000_000; unit = "m"; }
  else if (unit === "cm" && value >= 10_000) { value /= 10_000; unit = "m"; }
  else if (unit === "in" && value >= 144) { value /= 144; unit = "ft"; }
  return { value, unit };
}

export function formatDimFromPixels(
  pixels: number,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): string {
  const real = realLengthFromPixels(pixels, dpi, drawingScale);
  if (!real) return "";
  return `${roundReal(real.value)}${real.unit}`;
}

/** Real-world area from a pixel² value + drawing scale. Empty when scale is not configured. */
export function formatAreaFromPixels(
  pixelArea: number,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): string {
  const real = realAreaFromPixels(pixelArea, dpi, drawingScale);
  if (!real) return "";
  return `${roundReal(real.value)}${real.unit}²`;
}

/** Real-world size from pixel geometry + drawing scale. Empty when scale is not configured.
 *  Bounded shapes include their enclosed area: bbox "W×H · A", circle "⌀d · A", polygon "A". */
export function formatAnnotationCalculatedSize(
  ann: CanonicalAnnotation,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): string {
  if (getRealUnitsPerPixel(dpi, drawingScale) === null) return "";

  if (ann.type === "bbox") {
    const { w, h } = bboxToKonva(ann.points);
    const area = formatAreaFromPixels(annotationPixelArea(ann), dpi, drawingScale);
    return `${formatDimFromPixels(w, dpi, drawingScale)}×${formatDimFromPixels(h, dpi, drawingScale)} · ${area}`;
  }
  if (ann.type === "circle") {
    const { w } = bboxToKonva(ann.points);
    const area = formatAreaFromPixels(annotationPixelArea(ann), dpi, drawingScale);
    return `⌀${formatDimFromPixels(w, dpi, drawingScale)} · ${area}`;
  }
  if (ann.type === "polygon") {
    return formatAreaFromPixels(annotationPixelArea(ann), dpi, drawingScale);
  }
  if (ann.type === "line") {
    const dx = ann.points[1]![0] - ann.points[0]![0];
    const dy = ann.points[1]![1] - ann.points[0]![1];
    return formatDimFromPixels(Math.hypot(dx, dy), dpi, drawingScale);
  }
  if (ann.type === "polyline") {
    return formatDimFromPixels(annotationPixelPerimeter(ann), dpi, drawingScale);
  }
  return "";
}

/** Real-world perimeter of a bounded shape (bbox / polygon / circle). Empty for open
 *  shapes — their length is already the value `formatAnnotationCalculatedSize` returns. */
export function formatAnnotationPerimeter(
  ann: CanonicalAnnotation,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): string {
  if (!isAreaAnnotation(ann)) return "";
  if (getRealUnitsPerPixel(dpi, drawingScale) === null) return "";
  return formatDimFromPixels(annotationPixelPerimeter(ann), dpi, drawingScale);
}
