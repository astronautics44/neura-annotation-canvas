import React from "react";

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;
export const HANDLE_RADIUS = 7;
export const VERTEX_RADIUS = 5;
export const CLOSE_DIST = 10;

export const AUTO_COLORS = [
  "#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA",
  "#FB923C", "#38BDF8", "#4ADE80", "#E879F9", "#F472B6",
];

export const zoomBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  background: "transparent",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  color: "var(--ae-text-secondary)",
  padding: 0,
  transition: "background 0.1s, color 0.1s",
};

export type DrawState =
  | { phase: "idle" }
  | { phase: "bbox-drawing"; start: [number, number]; cur: [number, number] }
  | { phase: "bbox-pending"; points: [[number, number], [number, number]]; pos: [number, number] }
  | { phase: "polygon-drawing"; pts: [number, number][]; cur: [number, number] }
  | { phase: "polygon-pending"; pts: [number, number][]; pos: [number, number] }
  | { phase: "polyline-drawing"; pts: [number, number][]; cur: [number, number] }
  | { phase: "polyline-pending"; pts: [number, number][]; pos: [number, number] }
  | { phase: "line-drawing"; start: [number, number]; cur: [number, number] }
  | { phase: "line-pending"; points: [[number, number], [number, number]]; pos: [number, number] }
  | { phase: "point-pending"; pt: [number, number]; pos: [number, number] }
  | { phase: "circle-drawing"; center: [number, number]; cur: [number, number] }
  | { phase: "circle-pending"; points: [[number, number], [number, number]]; pos: [number, number] }
  | { phase: "count-drawing"; pts: [number, number][]; cur: [number, number] }
  | { phase: "count-pending"; pts: [number, number][]; pos: [number, number] };

export type Action =
  | { type: "LOAD"; payload: import("../types/canonical").CanonicalAnnotation[] }
  | { type: "ADD"; payload: import("../types/canonical").CanonicalAnnotation }
  | { type: "ADD_MANY"; payload: import("../types/canonical").CanonicalAnnotation[] }
  | { type: "UPDATE"; payload: import("../types/canonical").CanonicalAnnotation }
  | { type: "DELETE"; id: string }
  | { type: "DELETE_MANY"; ids: string[] }
  | { type: "MOVE"; id: string; delta: [number, number] }
  | { type: "MOVE_MANY"; ids: string[]; delta: [number, number] }
  | { type: "REPLACE_MANY"; removeIds: string[]; add: import("../types/canonical").CanonicalAnnotation[] }
  | { type: "REORDER"; id: string; direction: "forward" | "backward" }
  | { type: "BRING_TO_TOP"; id: string };
