export type ToolType = "select" | "bbox" | "polygon" | "polyline" | "line" | "point" | "circle" | "count";

export type AnnotationType = "bbox" | "polygon" | "polyline" | "line" | "point" | "circle";

export interface CanonicalAnnotation {
  id: string;
  type: AnnotationType;
  points: [number, number][];
  label: string;
  confidence?: number;
  source: "engine" | "human";
  meta?: Record<string, unknown>;
}

export type SymbolSizeUnit = "mm" | "cm" | "m" | "in" | "ft";

/** Manual real-world size for a symbol, stored in `annotation.meta.symbolSize`. */
export interface SymbolSize {
  /** Dimension name, e.g. "diameter", "thickness". */
  attribute: string;
  value: number;
  unit: SymbolSizeUnit;
}

export interface LabelMap {
  canonicalClassId: string;
  displayName: string;
  color: string;
  defaultTool?: AnnotationType;
  /**
   * When set, the label popover collects a manual symbol size (attribute + value + unit).
   * Independent of drawing scale — user-entered takeoff dimensions.
   */
  symbolSize?: "optional" | "required";
  /** Override default attribute dropdown options for this label. */
  symbolSizeAttributes?: string[];
}
