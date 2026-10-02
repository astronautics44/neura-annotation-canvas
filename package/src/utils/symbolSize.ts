import type { SymbolSize, SymbolSizeUnit } from "../types/canonical";

/** The one attribute entered as three dimensions instead of one value. */
export const VOLUME_ATTRIBUTE = "volume";

export const DEFAULT_SYMBOL_SIZE_ATTRIBUTES = [
  "diameter",
  "thickness",
  "width",
  "height",
  "depth",
  "length",
  "radius",
  "gauge",
  VOLUME_ATTRIBUTE,
] as const;

export const SYMBOL_SIZE_UNITS: SymbolSizeUnit[] = ["mm", "cm", "m", "in", "ft"];

const VALID_UNITS = new Set<string>(SYMBOL_SIZE_UNITS);

export function isVolumeAttribute(attribute: string): boolean {
  return attribute.trim().toLowerCase() === VOLUME_ATTRIBUTE;
}

function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * `"3x4x5"`, `"3 × 4 × 5"`, `"3*4*5"` or `"3 by 4 by 5"` → `[3, 4, 5]`.
 * Anything but exactly three positive numbers is `undefined`.
 */
export function parseDimensions(input: string): [number, number, number] | undefined {
  const parts = input.trim().split(/\s*(?:x|×|\*|by)\s*/i);
  if (parts.length !== 3 || parts.some((p) => p === "")) return undefined;
  const nums = parts.map(Number);
  if (!nums.every(isPositive)) return undefined;
  return [nums[0]!, nums[1]!, nums[2]!];
}

export function dimensionsToInput(dims: [number, number, number]): string {
  return dims.map(formatSymbolSizeValue).join("x");
}

export function parseSymbolSize(meta?: Record<string, unknown>): SymbolSize | undefined {
  const raw = meta?.symbolSize;
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const attribute = obj.attribute;
  const value = obj.value;
  const unit = obj.unit;
  if (typeof attribute !== "string" || attribute.trim() === "") return undefined;
  if (typeof unit !== "string" || !VALID_UNITS.has(unit)) return undefined;
  const dims = obj.dimensions;
  // Three dimensions win over `value`: the product is derived, so a stale one
  // from a hand-edited payload is recomputed rather than trusted.
  const [l, w, h] = Array.isArray(dims) && dims.length === 3 ? dims : [];
  if (isPositive(l) && isPositive(w) && isPositive(h)) {
    const d: [number, number, number] = [l, w, h];
    return { attribute: attribute.trim(), value: d[0] * d[1] * d[2], unit: unit as SymbolSizeUnit, dimensions: d };
  }
  if (!isPositive(value)) return undefined;
  return { attribute: attribute.trim(), value, unit: unit as SymbolSizeUnit };
}

/** Chip and card display: `diameter 12mm`, `volume 3×4×5in` */
export function formatSymbolSize(size: SymbolSize): string {
  return `${size.attribute} ${formatSymbolSizeAmount(size)}`;
}

/** Panel display: `diameter - 12mm`, `volume - 3×4×5in (60in³)` */
export function formatSymbolSizeLabel(size: SymbolSize): string {
  return `${size.attribute} - ${formatSymbolSizeMeasure(size)}`;
}

/** The size without its attribute: `12mm`, `3×4×5in (60in³)` */
export function formatSymbolSizeMeasure(size: SymbolSize): string {
  const total = size.dimensions ? ` (${formatSymbolSizeValue(size.value)}${size.unit}³)` : "";
  return `${formatSymbolSizeAmount(size)}${total}`;
}

function formatSymbolSizeAmount(size: SymbolSize): string {
  if (size.dimensions) return `${size.dimensions.map(formatSymbolSizeValue).join("×")}${size.unit}`;
  return `${formatSymbolSizeValue(size.value)}${size.unit}`;
}

function formatSymbolSizeValue(value: number): string {
  return value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
}
