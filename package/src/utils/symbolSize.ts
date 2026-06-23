import type { SymbolSize, SymbolSizeUnit } from "../types/canonical";

export const DEFAULT_SYMBOL_SIZE_ATTRIBUTES = [
  "diameter",
  "thickness",
  "width",
  "height",
  "depth",
  "length",
  "radius",
  "gauge",
] as const;

export const SYMBOL_SIZE_UNITS: SymbolSizeUnit[] = ["mm", "cm", "m", "in", "ft"];

const VALID_UNITS = new Set<string>(SYMBOL_SIZE_UNITS);

export function parseSymbolSize(meta?: Record<string, unknown>): SymbolSize | undefined {
  const raw = meta?.symbolSize;
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const attribute = obj.attribute;
  const value = obj.value;
  const unit = obj.unit;
  if (typeof attribute !== "string" || attribute.trim() === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  if (typeof unit !== "string" || !VALID_UNITS.has(unit)) return undefined;
  return { attribute: attribute.trim(), value, unit: unit as SymbolSizeUnit };
}

export function formatSymbolSize(size: SymbolSize): string {
  const val = size.value % 1 === 0 ? size.value.toString() : size.value.toFixed(2).replace(/\.?0+$/, "");
  return `${size.attribute} ${val}${size.unit}`;
}
