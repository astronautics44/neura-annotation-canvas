import type { LabelMap } from "@astronautics44/neura-annotation-canvas";

export const labelRegistry: LabelMap[] = [
  { canonicalClassId: "door", displayName: "Door", color: "#FF6B6B", defaultTool: "bbox" },
  { canonicalClassId: "window", displayName: "Window", color: "#4ECDC4", defaultTool: "bbox" },
  { canonicalClassId: "wall", displayName: "Wall", color: "#FFE66D", defaultTool: "polygon" },
  { canonicalClassId: "room", displayName: "Room", color: "#A8E6CF", defaultTool: "polygon" },
  { canonicalClassId: "column", displayName: "Column", color: "#B8B8FF", defaultTool: "point" },
  { canonicalClassId: "stair", displayName: "Stair", color: "#FF9A9E", defaultTool: "polygon" },
];
