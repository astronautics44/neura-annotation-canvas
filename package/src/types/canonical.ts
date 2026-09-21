export type ToolType =
  | "select" | "bbox" | "polygon" | "polyline" | "line" | "point" | "circle" | "count"
  /** Comment mode. Not an annotation type — comments never enter the annotation payload. */
  | "comment";

export type AnnotationType = "bbox" | "polygon" | "polyline" | "line" | "point" | "circle";

export interface CanonicalAnnotation {
  id: string;
  type: AnnotationType;
  points: [number, number][];
  label: string;
  confidence?: number;
  source: "engine" | "human";
  meta?: Record<string, unknown>;
  /**
   * The `AnnotationGroup` this annotation belongs to, by id. At most one. Read
   * only when the canvas has `enableGroups`; a value naming no group is ignored.
   */
  group?: string;
  /**
   * True when this mark is optional. Read and drawn only when the canvas has
   * `enableOptional`; absent means false.
   */
  optional?: boolean;
}

/**
 * A named set of annotations on one image, whatever their shape or label: the
 * switches in a bathroom. Its colour replaces the label colour of every member.
 */
export interface AnnotationGroup {
  id: string;
  name: string;
  /** A literal `#rrggbb`: it is painted by Konva, which has no stylesheet. */
  color: string;
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
