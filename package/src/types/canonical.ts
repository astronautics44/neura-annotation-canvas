export type ToolType = "select" | "bbox" | "polygon" | "line" | "point" | "circle";

export type AnnotationType = "bbox" | "polygon" | "line" | "point" | "circle";

export interface CanonicalAnnotation {
  id: string;
  type: AnnotationType;
  points: [number, number][];
  label: string;
  confidence?: number;
  source: "engine" | "human";
  meta?: Record<string, unknown>;
}

export interface LabelMap {
  canonicalClassId: string;
  displayName: string;
  color: string;
  defaultTool?: AnnotationType;
}
