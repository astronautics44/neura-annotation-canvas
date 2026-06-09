"use client";

import React, {
  useReducer,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as StageType } from "konva/lib/Stage";
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Group, Text } from "react-konva";
import useImage from "use-image";
import type { CanonicalAnnotation, LabelMap, ToolType } from "../types/canonical";
import { newId } from "../utils/ids";
import { Toolbar } from "./Toolbar";
import { LabelPanel } from "./LabelPanel";
import { LabelPopover } from "./LabelPopover";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: "LOAD"; payload: CanonicalAnnotation[] }
  | { type: "ADD"; payload: CanonicalAnnotation }
  | { type: "UPDATE"; payload: CanonicalAnnotation }
  | { type: "DELETE"; id: string }
  | { type: "MOVE"; id: string; delta: [number, number] };

function reducer(state: CanonicalAnnotation[], action: Action): CanonicalAnnotation[] {
  switch (action.type) {
    case "LOAD":   return action.payload;
    case "ADD":    return [...state, action.payload];
    case "UPDATE": return state.map((a) => (a.id === action.payload.id ? action.payload : a));
    case "DELETE": return state.filter((a) => a.id !== action.id);
    case "MOVE":   return state.map((a) =>
      a.id !== action.id ? a : {
        ...a,
        points: a.points.map(([x, y]) => [x + action.delta[0], y + action.delta[1]] as [number, number]),
      });
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  image: string;
  labels: LabelMap[];
  annotations?: CanonicalAnnotation[];
  onSave: (annotations: CanonicalAnnotation[]) => void;
  onChange?: (annotations: CanonicalAnnotation[]) => void;
  onLabelsChange?: (labels: LabelMap[]) => void;
  tools?: ToolType[];
  readonly?: boolean;
  className?: string;
}

// Rotating palette for auto-assigned label colors
const AUTO_COLORS = [
  "#60A5FA","#34D399","#FBBF24","#F87171","#A78BFA",
  "#FB923C","#38BDF8","#4ADE80","#E879F9","#F472B6",
];

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "label";
}

type DrawState =
  | { phase: "idle" }
  | { phase: "bbox-drawing"; start: [number, number]; cur: [number, number] }
  | { phase: "bbox-pending"; points: [[number, number], [number, number]]; pos: [number, number] }
  | { phase: "polygon-drawing"; pts: [number, number][]; cur: [number, number] }
  | { phase: "polygon-pending"; pts: [number, number][]; pos: [number, number] }
  | { phase: "line-drawing"; start: [number, number]; cur: [number, number] }
  | { phase: "line-pending"; points: [[number, number], [number, number]]; pos: [number, number] }
  | { phase: "point-pending"; pt: [number, number]; pos: [number, number] };

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 20;
const HANDLE_RADIUS = 7;
const VERTEX_RADIUS = 5;
const CLOSE_DIST = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function bboxToKonva(pts: [number, number][]): { x: number; y: number; w: number; h: number } {
  const x1 = pts[0]![0], y1 = pts[0]![1], x2 = pts[1]![0], y2 = pts[1]![1];
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function screenToImage(sx: number, sy: number, stageX: number, stageY: number, scale: number): [number, number] {
  return [(sx - stageX) / scale, (sy - stageY) / scale];
}

function centroid(pts: [number, number][]): [number, number] {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

function bboxHandles(x: number, y: number, w: number, h: number) {
  return [
    { pos: [x, y]           as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [[p[0]![0]+dx, p[0]![1]+dy] as [number,number], p[1]!] },
    { pos: [x+w/2, y]       as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [[p[0]![0], p[0]![1]+dy] as [number,number], p[1]!] },
    { pos: [x+w, y]         as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [[p[0]![0], p[0]![1]+dy] as [number,number], [p[1]![0]+dx, p[1]![1]] as [number,number]] },
    { pos: [x+w, y+h/2]     as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [p[0]!, [p[1]![0]+dx, p[1]![1]] as [number,number]] },
    { pos: [x+w, y+h]       as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [p[0]!, [p[1]![0]+dx, p[1]![1]+dy] as [number,number]] },
    { pos: [x+w/2, y+h]     as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [p[0]!, [p[1]![0], p[1]![1]+dy] as [number,number]] },
    { pos: [x, y+h]         as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [[p[0]![0]+dx, p[0]![1]] as [number,number], [p[1]![0], p[1]![1]+dy] as [number,number]] },
    { pos: [x, y+h/2]       as [number,number], resizeFn: (dx: number, dy: number, p: [number,number][]) => [[p[0]![0]+dx, p[0]![1]] as [number,number], p[1]!] },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnotationCanvas({
  image,
  labels: labelsProp,
  annotations: initialAnnotations,
  onSave,
  onChange,
  onLabelsChange,
  tools,
  readonly = false,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageType>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [img] = useImage(image, "anonymous");

  // Internal label registry — initialized from prop, grows when user creates labels
  const [labels, setLabels] = useState<LabelMap[]>(labelsProp);
  useEffect(() => { setLabels(labelsProp); }, [labelsProp]);

  const [annotations, dispatch] = useReducer(reducer, initialAnnotations ?? []);

  // Undo/redo history (refs — don't need to trigger renders)
  const past = useRef<CanonicalAnnotation[][]>([]);
  const future = useRef<CanonicalAnnotation[][]>([]);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const [tool, setTool] = useState<ToolType>("select");
  const [panMode, setPanMode] = useState(false); // H hand tool
  const [draw, setDraw] = useState<DrawState>({ phase: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [cursorImg, setCursorImg] = useState<[number, number]>([0, 0]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingAnnotation, setDraggingAnnotation] = useState<{ id: string; startImg: [number, number] } | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{ annId: string; handleIdx: number; startImg: [number, number] } | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ annId: string; vertIdx: number; startImg: [number, number] } | null>(null);

  // Snapshot current state before a mutating action (for undo)
  const snapshot = useCallback(() => {
    past.current = [...past.current, [...annotationsRef.current]];
    future.current = [];
    if (past.current.length > 100) past.current = past.current.slice(-100);
  }, []);

  // Dispatch with undo tracking
  const dispatchAndNotify = useCallback((action: Action) => {
    if (action.type !== "LOAD") snapshot();
    dispatch(action);
  }, [snapshot]);

  useEffect(() => {
    onChange?.(annotations);
  }, [annotations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialAnnotations) {
      past.current = [];
      future.current = [];
      dispatch({ type: "LOAD", payload: initialAnnotations });
    }
  }, [initialAnnotations]);

  // Container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitToScreen = useCallback(() => {
    if (!img) return;
    const padding = 32;
    const s = Math.min((containerSize.w - padding * 2) / img.width, (containerSize.h - padding * 2) / img.height, 1);
    setScale(s);
    setStagePos({ x: (containerSize.w - img.width * s) / 2, y: (containerSize.h - img.height * s) / 2 });
  }, [img, containerSize]);

  useEffect(() => { if (img) fitToScreen(); }, [img, fitToScreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Undo: Cmd/Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (past.current.length === 0) return;
        future.current = [annotationsRef.current, ...future.current];
        const prev = past.current[past.current.length - 1]!;
        past.current = past.current.slice(0, -1);
        dispatch({ type: "LOAD", payload: prev });
        return;
      }

      // Redo: Cmd/Ctrl+Shift+Z  or  Ctrl+Y
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") ||
          (e.ctrlKey && e.key === "y")) {
        e.preventDefault();
        if (future.current.length === 0) return;
        past.current = [...past.current, annotationsRef.current];
        const next = future.current[0]!;
        future.current = future.current.slice(1);
        dispatch({ type: "LOAD", payload: next });
        return;
      }

      if (e.code === "Space") { setSpaceDown(true); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === "0") { e.preventDefault(); fitToScreen(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "=") { e.preventDefault(); setScale((s) => Math.min(s * 1.2, MAX_ZOOM)); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); setScale((s) => Math.max(s / 1.2, MIN_ZOOM)); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); onSave(annotationsRef.current); return; }

      if (e.key === "h" || e.key === "H") { setPanMode((p) => !p); setDraw({ phase: "idle" }); return; }
      if (e.key === "Escape") { setPanMode(false); setTool("select"); setDraw({ phase: "idle" }); return; }
      if (e.key === "v" || e.key === "V") { setPanMode(false); setTool("select"); setDraw({ phase: "idle" }); return; }
      if (e.key === "b" || e.key === "B") { setPanMode(false); setTool("bbox"); setDraw({ phase: "idle" }); return; }
      if (e.key === "p" || e.key === "P") { setPanMode(false); setTool("polygon"); setDraw({ phase: "idle" }); return; }
      if (e.key === "l" || e.key === "L") { setPanMode(false); setTool("line"); setDraw({ phase: "idle" }); return; }
      if (e.key === "n" || e.key === "N") { setPanMode(false); setTool("point"); setDraw({ phase: "idle" }); return; }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        dispatchAndNotify({ type: "DELETE", id: selectedId });
        setSelectedId(null);
        return;
      }

      if (e.key === "Enter" && draw.phase === "polygon-drawing" && draw.pts.length >= 3) {
        const pos = draw.pts[draw.pts.length - 1] ?? [0, 0];
        setDraw({ phase: "polygon-pending", pts: draw.pts, pos: pos as [number, number] });
        return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [draw, fitToScreen, onSave, selectedId, dispatchAndNotify]);

  // ---------------------------------------------------------------------------
  // Stage event handlers
  // ---------------------------------------------------------------------------

  const getImagePos = useCallback((e: KonvaEventObject<MouseEvent>): [number, number] => {
    const stage = e.target.getStage();
    if (!stage) return [0, 0];
    const ptr = stage.getPointerPosition();
    if (!ptr) return [0, 0];
    return screenToImage(ptr.x, ptr.y, stagePos.x, stagePos.y, scale);
  }, [stagePos, scale]);

  const panStart = useRef<{ x: number; y: number; stageX: number; stageY: number } | null>(null);

  const shouldPan = useCallback((e: KonvaEventObject<MouseEvent>) =>
    panMode || spaceDown || e.evt.button === 1, [panMode, spaceDown]);

  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (shouldPan(e)) {
      panStart.current = { x: e.evt.clientX, y: e.evt.clientY, stageX: stagePos.x, stageY: stagePos.y };
      setIsPanning(true);
      return;
    }
    if (readonly) return;

    const isStageClick = e.target === e.target.getStage() || e.target.name() === "bg-image";
    const imgPos = getImagePos(e);

    if (tool === "select") { if (isStageClick) setSelectedId(null); return; }
    if (tool === "bbox") { setDraw({ phase: "bbox-drawing", start: imgPos, cur: imgPos }); return; }

    if (tool === "polygon") {
      if (draw.phase === "polygon-drawing") {
        if (draw.pts.length >= 3) {
          const first = draw.pts[0]!;
          const dx = first[0] - imgPos[0], dy = first[1] - imgPos[1];
          if (Math.sqrt(dx * dx + dy * dy) * scale < CLOSE_DIST) {
            setDraw({ phase: "polygon-pending", pts: draw.pts, pos: imgPos });
            return;
          }
        }
        setDraw({ ...draw, pts: [...draw.pts, imgPos] });
      } else {
        setDraw({ phase: "polygon-drawing", pts: [imgPos], cur: imgPos });
      }
      return;
    }

    if (tool === "line") {
      if (draw.phase === "line-drawing") setDraw({ phase: "line-pending", points: [draw.start, imgPos], pos: imgPos });
      else setDraw({ phase: "line-drawing", start: imgPos, cur: imgPos });
      return;
    }

    if (tool === "point") { setDraw({ phase: "point-pending", pt: imgPos, pos: imgPos }); return; }
  }, [shouldPan, readonly, tool, draw, getImagePos, scale, stagePos]);

  const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const imgPos = screenToImage(ptr.x, ptr.y, stagePos.x, stagePos.y, scale);
    setCursorImg(imgPos);

    if (panStart.current) {
      const dx = e.evt.clientX - panStart.current.x;
      const dy = e.evt.clientY - panStart.current.y;
      setStagePos({ x: panStart.current.stageX + dx, y: panStart.current.stageY + dy });
      return;
    }

    if (draw.phase === "bbox-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "polygon-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "line-drawing") setDraw({ ...draw, cur: imgPos });

    if (draggingAnnotation) {
      const dx = imgPos[0] - draggingAnnotation.startImg[0];
      const dy = imgPos[1] - draggingAnnotation.startImg[1];
      dispatchAndNotify({ type: "MOVE", id: draggingAnnotation.id, delta: [dx, dy] });
      setDraggingAnnotation({ ...draggingAnnotation, startImg: imgPos });
    }

    if (draggingHandle) {
      const ann = annotationsRef.current.find((a) => a.id === draggingHandle.annId);
      if (ann) {
        const dx = imgPos[0] - draggingHandle.startImg[0];
        const dy = imgPos[1] - draggingHandle.startImg[1];
        const { x, y, w, h } = bboxToKonva(ann.points);
        const handle = bboxHandles(x, y, w, h)[draggingHandle.handleIdx];
        if (handle) {
          dispatchAndNotify({ type: "UPDATE", payload: { ...ann, points: handle.resizeFn(dx, dy, ann.points as [[number,number],[number,number]]) } });
        }
        setDraggingHandle({ ...draggingHandle, startImg: imgPos });
      }
    }

    if (draggingVertex) {
      const ann = annotationsRef.current.find((a) => a.id === draggingVertex.annId);
      if (ann) {
        dispatchAndNotify({ type: "UPDATE", payload: { ...ann, points: ann.points.map((p, i) => i === draggingVertex.vertIdx ? imgPos : p) as [number,number][] } });
        setDraggingVertex({ ...draggingVertex, startImg: imgPos });
      }
    }
  }, [draw, stagePos, scale, draggingAnnotation, draggingHandle, draggingVertex, dispatchAndNotify]);

  const handleStageMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (panStart.current) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }
    if (readonly) return;
    const imgPos = getImagePos(e);
    if (draw.phase === "bbox-drawing") {
      const { w, h } = bboxToKonva([draw.start, imgPos]);
      if (w < 8 || h < 8) { setDraw({ phase: "idle" }); return; }
      setDraw({ phase: "bbox-pending", points: [draw.start, imgPos], pos: imgPos });
    }
    setDraggingAnnotation(null);
    setDraggingHandle(null);
    setDraggingVertex(null);
  }, [readonly, draw, getImagePos]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * (dir > 0 ? 1.1 : 1 / 1.1)));
    const mouseX = (ptr.x - stagePos.x) / scale;
    const mouseY = (ptr.y - stagePos.y) / scale;
    setScale(newScale);
    setStagePos({ x: ptr.x - mouseX * newScale, y: ptr.y - mouseY * newScale });
  }, [scale, stagePos]);

  const handleAnnotationClick = useCallback((id: string, e: KonvaEventObject<MouseEvent>) => {
    if (tool !== "select" || readonly || panMode) return;
    e.cancelBubble = true;
    setSelectedId(id);
  }, [tool, readonly, panMode]);

  const handleAnnotationMouseDown = useCallback((id: string, e: KonvaEventObject<MouseEvent>) => {
    if (tool !== "select" || readonly || panMode) return;
    e.cancelBubble = true;
    setSelectedId(id);
    setDraggingAnnotation({ id, startImg: getImagePos(e) });
  }, [tool, readonly, panMode, getImagePos]);

  const handleLabelSelect = useCallback((label: string) => {
    if (draw.phase === "bbox-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "bbox", points: draw.points, label, source: "human" } });
    } else if (draw.phase === "polygon-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "polygon", points: draw.pts, label, source: "human" } });
    } else if (draw.phase === "line-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "line", points: draw.points, label, source: "human" } });
    } else if (draw.phase === "point-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "point", points: [draw.pt], label, source: "human" } });
    }
    setDraw({ phase: "idle" });
    setTool("select");
  }, [draw, dispatchAndNotify]);

  const handlePopoverCancel = useCallback(() => setDraw({ phase: "idle" }), []);

  const handleCreateLabel = useCallback((displayName: string): string => {
    const base = slugify(displayName);
    // ensure unique canonicalClassId
    let id = base;
    let n = 2;
    while (labels.some((l) => l.canonicalClassId === id)) { id = `${base}-${n++}`; }
    const usedColors = new Set(labels.map((l) => l.color));
    const color = AUTO_COLORS.find((c) => !usedColors.has(c)) ?? AUTO_COLORS[labels.length % AUTO_COLORS.length]!;
    const newLabel: LabelMap = { canonicalClassId: id, displayName, color };
    setLabels((prev) => {
      const next = [...prev, newLabel];
      onLabelsChange?.(next);
      return next;
    });
    return id;
  }, [labels, onLabelsChange]);

  const popoverPos = (): { x: number; y: number } | null => {
    if (!["bbox-pending","polygon-pending","line-pending","point-pending"].includes(draw.phase)) return null;
    const pos = (draw as { pos: [number,number] }).pos;
    return { x: pos[0] * scale + stagePos.x, y: pos[1] * scale + stagePos.y };
  };

  const pPos = popoverPos();

  const stageCursor = isPanning ? "grabbing"
    : panMode ? "grab"
    : spaceDown ? "grab"
    : tool === "select" ? "default"
    : "crosshair";

  // ---------------------------------------------------------------------------
  // Render annotations
  // ---------------------------------------------------------------------------

  const renderAnnotation = (ann: CanonicalAnnotation) => {
    const lm = labels.find((l) => l.canonicalClassId === ann.label);
    const color = lm?.color ?? "#ffffff";
    const isSelected = selectedId === ann.id;
    const isHovered = hoveredId === ann.id;
    const isEngine = ann.source === "engine";

    const baseStrokeWidth = isEngine ? 1.5 : 2;
    const strokeWidth = isSelected ? 2 : isHovered ? 2.5 : baseStrokeWidth;
    const opacity = isEngine ? 0.85 : 1.0;
    const fillAlpha = isSelected ? 0.18 : isHovered ? 0.15 : isEngine ? 0.08 : 0.12;

    const commonProps = {
      stroke: color,
      strokeWidth: strokeWidth / scale,
      opacity,
      onClick: (e: KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann.id, e),
      onMouseDown: (e: KonvaEventObject<MouseEvent>) => handleAnnotationMouseDown(ann.id, e),
      onMouseEnter: () => setHoveredId(ann.id),
      onMouseLeave: () => setHoveredId(null),
    };

    const chipVisible = scale >= 0.3;
    let chipX = 0, chipY = 0;
    if (ann.type === "bbox") {
      chipX = Math.min(ann.points[0]![0], ann.points[1]![0]);
      chipY = Math.min(ann.points[0]![1], ann.points[1]![1]) - 16 / scale;
    } else if (ann.type === "polygon" || ann.type === "line") {
      const c = centroid(ann.points);
      chipX = c[0]; chipY = c[1];
    } else if (ann.type === "point") {
      chipX = ann.points[0]![0] + 10 / scale;
      chipY = ann.points[0]![1] - 8 / scale;
    }

    const chipLabel = lm?.displayName ?? ann.label;
    const chipConf = ann.confidence !== undefined ? ` ${Math.round(ann.confidence * 100)}%` : "";
    const chipWidth = (chipLabel.length + chipConf.length) * 6.5 / scale + 12 / scale;

    const chip = chipVisible ? (
      <Group x={chipX} y={chipY}>
        <Rect width={chipWidth} height={14 / scale} fill="rgba(0,0,0,0.65)" cornerRadius={3 / scale} />
        <Circle x={6 / scale} y={7 / scale} radius={3 / scale} fill={color} />
        <Text x={12 / scale} y={2 / scale} text={chipLabel + chipConf} fontSize={11 / scale} fill="#e8e8e8" fontFamily="system-ui" />
      </Group>
    ) : null;

    if (ann.type === "bbox") {
      const { x, y, w, h } = bboxToKonva(ann.points);
      return (
        <Group key={ann.id}>
          <Rect x={x} y={y} width={w} height={h} fill={hexToRgba(color, fillAlpha)} {...commonProps} />
          {isSelected && bboxHandles(x, y, w, h).map((handle, i) => (
            <Circle key={i} x={handle.pos[0]} y={handle.pos[1]}
              radius={HANDLE_RADIUS / scale} fill="#ffffff" stroke={color} strokeWidth={2 / scale}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                setDraggingHandle({ annId: ann.id, handleIdx: i, startImg: getImagePos(e) });
              }}
            />
          ))}
          {chip}
        </Group>
      );
    }

    if (ann.type === "polygon") {
      return (
        <Group key={ann.id}>
          <Line points={ann.points.flatMap(([x, y]) => [x, y])} closed fill={hexToRgba(color, fillAlpha)} {...commonProps} />
          {isSelected && ann.points.map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={VERTEX_RADIUS / scale} fill="#ffffff" stroke={color} strokeWidth={1.5 / scale}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                setDraggingVertex({ annId: ann.id, vertIdx: i, startImg: getImagePos(e) });
              }}
            />
          ))}
          {chip}
        </Group>
      );
    }

    if (ann.type === "line") {
      return (
        <Group key={ann.id}>
          <Line points={ann.points.flatMap(([x, y]) => [x, y])} hitStrokeWidth={10 / scale} {...commonProps} />
          {isSelected && ann.points.map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={HANDLE_RADIUS / scale} fill="#ffffff" stroke={color} strokeWidth={2 / scale}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                setDraggingVertex({ annId: ann.id, vertIdx: i, startImg: getImagePos(e) });
              }}
            />
          ))}
        </Group>
      );
    }

    if (ann.type === "point") {
      const [x, y] = ann.points[0]!;
      return (
        <Group key={ann.id}>
          <Circle x={x} y={y} radius={8 / scale} fill={color} stroke="#ffffff" strokeWidth={2 / scale} opacity={opacity}
            onClick={(e: KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann.id, e)}
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => handleAnnotationMouseDown(ann.id, e)}
            onMouseEnter={() => setHoveredId(ann.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        </Group>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // In-progress drawing overlays
  // ---------------------------------------------------------------------------

  const renderDraw = () => {
    if (draw.phase === "bbox-drawing") {
      const { x, y, w, h } = bboxToKonva([draw.start, draw.cur]);
      return <Rect x={x} y={y} width={w} height={h} stroke="#2563eb" strokeWidth={1.5 / scale} fill="rgba(37,99,235,0.1)" dash={[4 / scale, 4 / scale]} />;
    }

    if (draw.phase === "polygon-drawing" && draw.pts.length > 0) {
      const flat = draw.pts.flatMap(([x, y]) => [x, y]);
      const lastPt = draw.pts[draw.pts.length - 1]!;
      const firstPt = draw.pts[0]!;
      const dx = firstPt[0] - draw.cur[0], dy = firstPt[1] - draw.cur[1];
      const nearFirst = draw.pts.length >= 3 && (dx * dx + dy * dy) * scale * scale < CLOSE_DIST * CLOSE_DIST;
      return (
        <Group>
          {draw.pts.length > 1 && <Line points={flat} stroke="#2563eb" strokeWidth={1.5 / scale} />}
          <Line points={[lastPt[0], lastPt[1], draw.cur[0], draw.cur[1]]} stroke="#2563eb" strokeWidth={1.5 / scale} dash={[4 / scale, 4 / scale]} />
          {draw.pts.map(([x, y], i) => <Circle key={i} x={x} y={y} radius={4 / scale} fill="#ffffff" stroke="#2563eb" strokeWidth={1 / scale} />)}
          {nearFirst && <Circle x={firstPt[0]} y={firstPt[1]} radius={6 / scale} fill="#22c55e" opacity={0.7} />}
        </Group>
      );
    }

    if (draw.phase === "line-drawing") {
      return <Line points={[draw.start[0], draw.start[1], draw.cur[0], draw.cur[1]]} stroke="#2563eb" strokeWidth={1.5 / scale} dash={[4 / scale, 4 / scale]} />;
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  const availableTools = tools ?? (["select", "bbox", "polygon", "line", "point"] as ToolType[]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#141414", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", fontSize: 13, color: "#e8e8e8", overflow: "hidden" }} className={className ?? ""}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Toolbar
          tools={availableTools}
          activeTool={tool}
          panMode={panMode}
          onToolChange={(t) => { setPanMode(false); setTool(t); setDraw({ phase: "idle" }); }}
          onPanModeChange={setPanMode}
          readonly={readonly}
        />
        <div ref={containerRef} style={{ flex: 1, background: "#0f0f0f", position: "relative", overflow: "hidden", cursor: stageCursor }}>
          <Stage
            ref={stageRef}
            width={containerSize.w}
            height={containerSize.h}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={handleStageMouseDown as (e: KonvaEventObject<Event>) => void}
            onMouseMove={handleStageMouseMove as (e: KonvaEventObject<Event>) => void}
            onMouseUp={handleStageMouseUp as (e: KonvaEventObject<Event>) => void}
            onWheel={handleWheel}
            listening={true}
          >
            <Layer>
              {img && <KonvaImage image={img} x={0} y={0} width={img.width} height={img.height} name="bg-image" />}
              {annotations.map(renderAnnotation)}
              {renderDraw()}
            </Layer>
          </Stage>
          {pPos && (
            <LabelPopover
              labels={labels}
              position={pPos}
              onSelect={handleLabelSelect}
              onCancel={handlePopoverCancel}
              onCreateLabel={readonly ? undefined : handleCreateLabel}
            />
          )}
        </div>
        <LabelPanel
          annotations={annotations}
          labels={labels}
          selectedId={selectedId}
          onCreateLabel={readonly ? undefined : handleCreateLabel}
          onSelect={(id) => {
            setSelectedId(id);
            const ann = annotations.find((a) => a.id === id);
            if (!ann) return;
            const c = ann.type === "point" ? ann.points[0]! : centroid(ann.points);
            const sx = c[0] * scale + stagePos.x;
            const sy = c[1] * scale + stagePos.y;
            if (sx < 0 || sx > containerSize.w || sy < 0 || sy > containerSize.h) {
              setStagePos({ x: containerSize.w / 2 - c[0] * scale, y: containerSize.h / 2 - c[1] * scale });
            }
          }}
          onDelete={(id) => { dispatchAndNotify({ type: "DELETE", id }); if (selectedId === id) setSelectedId(null); }}
          onRelabel={(id, label) => {
            const ann = annotations.find((a) => a.id === id);
            if (ann) dispatchAndNotify({ type: "UPDATE", payload: { ...ann, label } });
          }}
        />
      </div>
      <div style={{ height: 28, background: "#1e1e1e", borderTop: "1px solid #333333", display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between", fontSize: 11, color: "#8a8a8a" }}>
        <span>Zoom: <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{Math.round(scale * 100)}%</span></span>
        <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>x: {Math.round(cursorImg[0])} y: {Math.round(cursorImg[1])}</span>
      </div>
    </div>
  );
}
