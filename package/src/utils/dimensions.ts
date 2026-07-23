import type { CanonicalAnnotation } from "../types/canonical";
import { bboxToKonva } from "../components/canvasHelpers";
import { annotationPixelArea } from "./booleanOps";

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

export function formatDimFromPixels(
  pixels: number,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): string {
  const realUnitsPerPixel = getRealUnitsPerPixel(dpi, drawingScale);
  if (realUnitsPerPixel === null || !drawingScale) return "";
  let val = pixels * realUnitsPerPixel;
  let unit = drawingScale.unit;
  if (unit === "mm" && val >= 1000) { val /= 1000; unit = "m"; }
  else if (unit === "cm" && val >= 100) { val /= 100; unit = "m"; }
  else if (unit === "in" && val >= 12) { val /= 12; unit = "ft"; }
  return `${val.toFixed(val < 10 ? 2 : 1)}${unit}`;
}

/** Real-world area from a pixel² value + drawing scale. Empty when scale is not configured. */
export function formatAreaFromPixels(
  pixelArea: number,
  dpi: number | undefined,
  drawingScale: DrawingScaleInput | undefined,
): string {
  const realUnitsPerPixel = getRealUnitsPerPixel(dpi, drawingScale);
  if (realUnitsPerPixel === null || !drawingScale) return "";
  let val = pixelArea * realUnitsPerPixel * realUnitsPerPixel;
  let unit: string = drawingScale.unit;
  // Same promotion thresholds as formatDimFromPixels, squared
  if (unit === "mm" && val >= 1_000_000) { val /= 1_000_000; unit = "m"; }
  else if (unit === "cm" && val >= 10_000) { val /= 10_000; unit = "m"; }
  else if (unit === "in" && val >= 144) { val /= 144; unit = "ft"; }
  return `${val.toFixed(val < 10 ? 2 : 1)}${unit}²`;
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
    let length = 0;
    for (let i = 1; i < ann.points.length; i++) {
      const prev = ann.points[i - 1]!;
      const cur = ann.points[i]!;
      length += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    }
    return formatDimFromPixels(length, dpi, drawingScale);
  }
  return "";
}
