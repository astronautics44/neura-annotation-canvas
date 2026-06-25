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
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Ellipse, Group, Text, Shape } from "react-konva";
import useImage from "use-image";
import type { CanonicalAnnotation, LabelMap, SymbolSize, ToolType } from "../types/canonical";
import type { ThemeVars } from "../theme";
import { resolveTheme, themeToCssVars } from "../theme";
import { newId } from "../utils/ids";
import { formatSymbolSize, parseSymbolSize } from "../utils/symbolSize";
import { formatAnnotationCalculatedSize } from "../utils/dimensions";
import type { DrawingScale } from "../utils/drawingScale";
import { DrawingScaleEditor } from "./DrawingScaleEditor";
import { Toolbar } from "./Toolbar";
import { LabelPanel } from "./LabelPanel";
import { LabelPopover } from "./LabelPopover";
import { ShapeOpsBar } from "./ShapeOpsBar";
import {
  getAnnotationRings,
  hollowAnnotations,
  intersectAnnotations,
  isAreaAnnotation,
  mergeAnnotations,
  subtractAnnotations,
  toggleHollow,
  type ShapeMeta,
} from "../utils/booleanOps";
import {
  MIN_ZOOM, MAX_ZOOM, HANDLE_RADIUS, VERTEX_RADIUS, CLOSE_DIST,
  AUTO_COLORS, zoomBtnStyle,
  type DrawState, type Action,
} from "./canvasConstants";
import {
  hexToRgba, bboxToKonva, screenToImage, centroid,
  bboxHandles, slugify, annotationReducer, getAnnotationBounds, boxesIntersect,
} from "./canvasHelpers";

export type { DrawingScale } from "../utils/drawingScale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  // --- required ---
  image: string;
  labels: LabelMap[];

  // --- data ---
  annotations?: CanonicalAnnotation[];
  onSave: (annotations: CanonicalAnnotation[]) => void;
  onChange?: (annotations: CanonicalAnnotation[]) => void;
  onLabelsChange?: (labels: LabelMap[]) => void;

  // --- tools ---
  tools?: ToolType[];

  // --- behavior ---
  readonly?: boolean;

  // --- feature toggles ---
  /** Show zoom in / zoom out / fit buttons in the status bar. Default: true */
  showZoomControls?: boolean;
  /** Show undo / redo buttons in the toolbar. Default: true */
  showUndoRedo?: boolean;
  /** Enable Ctrl/Cmd+A to select all annotations. Default: true */
  enableSelectAll?: boolean;
  /** Show fullscreen toggle button in the status bar. Default: true */
  showFullscreen?: boolean;
  /**
   * When label chips are visible on annotations.
   * - "always"         — always shown when zoom ≥ 30% (default)
   * - "hover"          — only while the cursor is over the annotation
   * - "selected"       — only when the annotation is selected
   * - "hover+selected" — on hover OR when selected
   */
  labelVisibility?: "always" | "hover" | "selected" | "hover+selected";
  /**
   * Gesture that commits a polyline in progress.
   * - "enter"        — press Enter to finish (default)
   * - "right-click"  — right-click anywhere on the canvas
   * - "double-click" — double-click to place the last point and finish
   */
  polylineFinishAction?: "enter" | "right-click" | "double-click";
  /**
   * Gesture that commits a count (multi-point) session in progress.
   * - "enter"        — press Enter to finish (default)
   * - "right-click"  — right-click anywhere on the canvas
   * - "double-click" — double-click to place the last point and finish
   */
  countFinishAction?: "enter" | "right-click" | "double-click";

  // --- scale ---
  /** Scanner resolution of the image in dots per inch. Required for real-world dimension display. */
  dpi?: number;
  /**
   * Drawing scale extracted by the CV engine (or set by the user).
   * value: real-world units per 1 paper unit.
   *   metric 1:100  → { value: 100, unit: "mm", label: "1:100" }
   *   imperial 1/4"=1' → { value: 48, unit: "in", label: '1/4"=1\'' }
   */
  drawingScale?: DrawingScale;
  /** Fires when the user edits the scale in the status bar. */
  onDrawingScaleChange?: (scale: DrawingScale) => void;

  /**
   * When provided, replaces the built-in label popover for newly drawn shapes.
   * Resolve with label metadata to commit the shape, or null to cancel.
   */
  onPendingShapeCommit?: (context: {
    geometryType: string;
    phase: string;
    position: { x: number; y: number };
  }) => Promise<{
    label: string;
    symbolSize?: SymbolSize;
    meta?: Record<string, unknown>;
  } | null>;

  // --- layout ---
  className?: string;
  theme?: Partial<ThemeVars>;
}

const PENDING_SHAPE_PHASES = [
  "bbox-pending",
  "polygon-pending",
  "polyline-pending",
  "line-pending",
  "point-pending",
  "circle-pending",
  "count-pending",
] as const;

type PendingShapePhase = (typeof PENDING_SHAPE_PHASES)[number];

function isPendingShapePhase(phase: DrawState["phase"]): phase is PendingShapePhase {
  return (PENDING_SHAPE_PHASES as readonly string[]).includes(phase);
}

export function AnnotationCanvas({
  image,
  labels: labelsProp,
  annotations: initialAnnotations,
  onSave,
  onChange,
  onLabelsChange,
  tools,
  readonly = false,
  showZoomControls = true,
  showUndoRedo = true,
  enableSelectAll = true,
  showFullscreen = true,
  labelVisibility = "always",
  polylineFinishAction = "enter",
  countFinishAction = "enter",
  dpi,
  drawingScale: drawingScaleProp,
  onDrawingScaleChange,
  onPendingShapeCommit,
  className,
  theme: themeProp,
}: Props) {
  const resolved = resolveTheme(themeProp);
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageType>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [img] = useImage(image, "anonymous");

  // Internal label registry — initialized from prop, grows when user creates labels
  const [labels, setLabels] = useState<LabelMap[]>(labelsProp);
  useEffect(() => { setLabels(labelsProp); }, [labelsProp]);

  const [annotations, dispatch] = useReducer(annotationReducer, initialAnnotations ?? []);

  // Undo/redo history (refs — don't need to trigger renders)
  const past = useRef<CanonicalAnnotation[][]>([]);
  const future = useRef<CanonicalAnnotation[][]>([]);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  // Tracks last click timestamps for double-click finish detection
  const lastPolylineClickRef = useRef<number>(0);
  const lastCountClickRef = useRef<number>(0);

  // Expose undo/redo availability to the toolbar
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [tool, setTool] = useState<ToolType>("select");
  const [panMode, setPanMode] = useState(false);
  const [draw, setDraw] = useState<DrawState>({ phase: "idle" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [cursorImg, setCursorImg] = useState<[number, number]>([0, 0]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingAnnotation, setDraggingAnnotation] = useState<{ id: string; startImg: [number, number] } | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{ annId: string; handleIdx: number; startImg: [number, number] } | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ annId: string; vertIdx: number; startImg: [number, number] } | null>(null);
  /** Drag-box multi-select while the select tool is active. */
  const [marquee, setMarquee] = useState<{ start: [number, number]; cur: [number, number]; additive: boolean } | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // requestFullscreen on the root element; fall back to documentElement for compatibility
      const target = rootRef.current ?? document.documentElement;
      target.requestFullscreen({ navigationUI: "hide" }).catch((err: unknown) => {
        console.error("[annotation-engine] fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen().catch((err: unknown) => {
        console.error("[annotation-engine] exit fullscreen failed:", err);
      });
    }
  }, []);

  // Drawing scale — local override wins over prop
  const [drawingScale, setDrawingScale] = useState<DrawingScale | undefined>(drawingScaleProp);
  useEffect(() => { setDrawingScale(drawingScaleProp); }, [drawingScaleProp]);
  const [scaleEditing, setScaleEditing] = useState(false);

  // Internal clipboard — stores copied annotations for Ctrl+C / Ctrl+V
  const [clipboard, setClipboard] = useState<CanonicalAnnotation[]>([]);

  // Which annotation is being relabeled (double-click or R key)
  const [relabelId, setRelabelId] = useState<string | null>(null);

  // Snapshot current state before a mutating action (for undo)
  const snapshot = useCallback(() => {
    past.current = [...past.current, [...annotationsRef.current]];
    future.current = [];
    if (past.current.length > 100) past.current = past.current.slice(-100);
    setCanUndo(true);
    setCanRedo(false);
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
    // Skip reloading when the incoming prop is the very array this component
    // last emitted through onChange. Controlled consumers feed onChange output
    // back into the `annotations` prop (the documented pattern); without this
    // guard that echo re-dispatches LOAD, which mutates internal state, which
    // re-fires onChange — an infinite update loop.
    if (initialAnnotations && initialAnnotations !== annotationsRef.current) {
      past.current = [];
      future.current = [];
      setCanUndo(false);
      setCanRedo(false);
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

  const handleUndo = useCallback(() => {
    if (past.current.length === 0) return;
    future.current = [annotationsRef.current, ...future.current];
    const prev = past.current[past.current.length - 1]!;
    past.current = past.current.slice(0, -1);
    dispatch({ type: "LOAD", payload: prev });
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (future.current.length === 0) return;
    past.current = [...past.current, annotationsRef.current];
    const next = future.current[0]!;
    future.current = future.current.slice(1);
    dispatch({ type: "LOAD", payload: next });
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, []);

  // Clone a set of annotations with fresh IDs and a pixel offset (image-space)
  const cloneAnnotations = useCallback((
    ids: string[],
    offset: [number, number] = [20, 20],
  ): CanonicalAnnotation[] =>
    ids
      .map((id) => annotationsRef.current.find((a) => a.id === id))
      .filter((a): a is CanonicalAnnotation => a != null)
      .map((a) => ({
        ...a,
        id: newId(),
        source: "human" as const,
        points: a.points.map(([x, y]) => [x + offset[0], y + offset[1]] as [number, number]),
      })),
  []);

  const selectedAreaAnnotations = useCallback((): CanonicalAnnotation[] => {
    return selectedIds
      .map((id) => annotationsRef.current.find((a) => a.id === id))
      .filter((a): a is CanonicalAnnotation => a != null && isAreaAnnotation(a));
  }, [selectedIds]);

  const applyShapeReplace = useCallback((results: CanonicalAnnotation[]) => {
    if (results.length === 0) return;
    dispatchAndNotify({
      type: "REPLACE_MANY",
      removeIds: selectedIds,
      add: results,
    });
    setSelectedIds(results.map((r) => r.id));
  }, [selectedIds, dispatchAndNotify]);

  const handleMerge = useCallback(() => {
    const results = mergeAnnotations(selectedAreaAnnotations(), newId);
    applyShapeReplace(results);
  }, [selectedAreaAnnotations, applyShapeReplace]);

  const handleSubtract = useCallback(() => {
    const results = subtractAnnotations(selectedAreaAnnotations(), newId);
    applyShapeReplace(results);
  }, [selectedAreaAnnotations, applyShapeReplace]);

  const handleIntersect = useCallback(() => {
    const results = intersectAnnotations(selectedAreaAnnotations(), newId);
    applyShapeReplace(results);
  }, [selectedAreaAnnotations, applyShapeReplace]);

  const handleCutHole = useCallback(() => {
    const results = hollowAnnotations(selectedAreaAnnotations(), newId);
    applyShapeReplace(results);
  }, [selectedAreaAnnotations, applyShapeReplace]);

  const handleToggleFill = useCallback(() => {
    const id = selectedIds[0];
    if (!id) return;
    const ann = annotationsRef.current.find((a) => a.id === id);
    if (!ann || !isAreaAnnotation(ann)) return;
    dispatchAndNotify({ type: "UPDATE", payload: toggleHollow(ann) });
  }, [selectedIds, dispatchAndNotify]);

  const handleBringForward = useCallback(() => {
    const id = selectedIds[0];
    if (!id) return;
    dispatchAndNotify({ type: "REORDER", id, direction: "forward" });
  }, [selectedIds, dispatchAndNotify]);

  const handleSendBackward = useCallback(() => {
    const id = selectedIds[0];
    if (!id) return;
    dispatchAndNotify({ type: "REORDER", id, direction: "backward" });
  }, [selectedIds, dispatchAndNotify]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Undo: Cmd/Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Cmd/Ctrl+Shift+Z  or  Ctrl+Y
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") ||
          (e.ctrlKey && e.key === "y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Copy: Cmd/Ctrl+C
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedIds.length > 0) {
        e.preventDefault();
        setClipboard(
          selectedIds
            .map((id) => annotationsRef.current.find((a) => a.id === id))
            .filter((a): a is CanonicalAnnotation => a != null),
        );
        return;
      }

      // Paste: Cmd/Ctrl+V
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && clipboard.length > 0 && !readonly) {
        e.preventDefault();
        const copies = clipboard.map((a) => ({
          ...a,
          id: newId(),
          source: "human" as const,
          points: a.points.map(([x, y]) => [x + 20, y + 20] as [number, number]),
        }));
        // Subsequent pastes keep drifting so the user can see them stacking
        setClipboard(copies);
        snapshot();
        dispatch({ type: "ADD_MANY", payload: copies });
        setSelectedIds(copies.map((c) => c.id));
        return;
      }

      // Duplicate in place: Cmd/Ctrl+D
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedIds.length > 0 && !readonly) {
        e.preventDefault();
        const copies = cloneAnnotations(selectedIds);
        snapshot();
        dispatch({ type: "ADD_MANY", payload: copies });
        setSelectedIds(copies.map((c) => c.id));
        return;
      }

      // Select all: Cmd/Ctrl+A
      if (enableSelectAll && (e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setSelectedIds(annotationsRef.current.map((a) => a.id));
        return;
      }

      if (e.code === "Space") { setSpaceDown(true); return; }

      if ((e.metaKey || e.ctrlKey) && e.key === "0") { e.preventDefault(); fitToScreen(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "=") { e.preventDefault(); setScale((s) => Math.min(s * 1.2, MAX_ZOOM)); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); setScale((s) => Math.max(s / 1.2, MIN_ZOOM)); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); onSave(annotationsRef.current); return; }

      if (e.key === "h" || e.key === "H") { setPanMode((p) => !p); setDraw({ phase: "idle" }); return; }
      if (e.key === "Escape") { setMarquee(null); setPanMode(false); setTool("select"); setDraw({ phase: "idle" }); setRelabelId(null); return; }
      if (e.key === "v" || e.key === "V") { setPanMode(false); setTool("select"); setDraw({ phase: "idle" }); return; }
      if (e.key === "b" || e.key === "B") { setPanMode(false); setTool("bbox"); setDraw({ phase: "idle" }); return; }
      if (e.key === "p" || e.key === "P") { setPanMode(false); setTool("polygon"); setDraw({ phase: "idle" }); return; }
      if (e.key === "y" || e.key === "Y") { setPanMode(false); setTool("polyline"); setDraw({ phase: "idle" }); return; }
      if (e.key === "l" || e.key === "L") { setPanMode(false); setTool("line"); setDraw({ phase: "idle" }); return; }
      if (e.key === "n" || e.key === "N") { setPanMode(false); setTool("point"); setDraw({ phase: "idle" }); return; }
      if (e.key === "c" || e.key === "C") { setPanMode(false); setTool("circle"); setDraw({ phase: "idle" }); return; }
      if (e.key === "t" || e.key === "T") { setPanMode(false); setTool("count"); setDraw({ phase: "idle" }); return; }

      // Shape boolean ops (area shapes only)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !readonly) {
        if (e.key === "U" || e.key === "u") { e.preventDefault(); handleMerge(); return; }
        if (e.key === "I" || e.key === "i") { e.preventDefault(); handleIntersect(); return; }
        if (e.key === "H" || e.key === "h") { e.preventDefault(); handleCutHole(); return; }
        if (e.key === "O" || e.key === "o") { e.preventDefault(); handleToggleFill(); return; }
        if (e.key === "_" || e.key === "-") { e.preventDefault(); handleSubtract(); return; }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0 && !readonly) {
        if (selectedIds.length === 1) {
          dispatchAndNotify({ type: "DELETE", id: selectedIds[0]! });
        } else {
          dispatchAndNotify({ type: "DELETE_MANY", ids: selectedIds });
        }
        setSelectedIds([]);
        return;
      }

      // Relabel: R key when one annotation is selected and not mid-draw
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && selectedIds.length === 1 && draw.phase === "idle" && !readonly) {
        e.preventDefault();
        setRelabelId(selectedIds[0]!);
        return;
      }

      if (e.key === "Enter" && draw.phase === "polygon-drawing" && draw.pts.length >= 3) {
        const pos = draw.pts[draw.pts.length - 1] ?? [0, 0];
        setDraw({ phase: "polygon-pending", pts: draw.pts, pos: pos as [number, number] });
        return;
      }
      if (e.key === "Enter" && draw.phase === "polyline-drawing" && draw.pts.length >= 2 && polylineFinishAction === "enter") {
        const pos = draw.pts[draw.pts.length - 1] ?? [0, 0];
        setDraw({ phase: "polyline-pending", pts: draw.pts, pos: pos as [number, number] });
        return;
      }
      if (e.key === "Enter" && draw.phase === "count-drawing" && draw.pts.length >= 1 && countFinishAction === "enter") {
        const pos = draw.pts[draw.pts.length - 1] ?? [0, 0];
        setDraw({ phase: "count-pending", pts: draw.pts, pos: pos as [number, number] });
        return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [draw, enableSelectAll, fitToScreen, handleRedo, handleUndo, onSave, selectedIds, dispatchAndNotify, clipboard, cloneAnnotations, readonly, snapshot, relabelId, handleMerge, handleSubtract, handleIntersect, handleCutHole, handleToggleFill, polylineFinishAction, countFinishAction]);

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

    if (tool === "select") {
      if (isStageClick) {
        setMarquee({ start: imgPos, cur: imgPos, additive: e.evt.shiftKey });
      }
      return;
    }
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

    if (tool === "polyline") {
      if (draw.phase === "polyline-drawing") {
        if (polylineFinishAction === "double-click") {
          const now = Date.now();
          if (now - lastPolylineClickRef.current < 300 && draw.pts.length >= 2) {
            // Second click within 300ms — commit without adding another vertex
            lastPolylineClickRef.current = 0;
            setDraw({ phase: "polyline-pending", pts: draw.pts, pos: imgPos });
            return;
          }
          lastPolylineClickRef.current = now;
        }
        setDraw({ ...draw, pts: [...draw.pts, imgPos] });
      } else {
        if (polylineFinishAction === "double-click") lastPolylineClickRef.current = Date.now();
        setDraw({ phase: "polyline-drawing", pts: [imgPos], cur: imgPos });
      }
      return;
    }

    if (tool === "line") {
      if (draw.phase === "line-drawing") setDraw({ phase: "line-pending", points: [draw.start, imgPos], pos: imgPos });
      else setDraw({ phase: "line-drawing", start: imgPos, cur: imgPos });
      return;
    }

    if (tool === "point") { setDraw({ phase: "point-pending", pt: imgPos, pos: imgPos }); return; }
    if (tool === "circle") { setDraw({ phase: "circle-drawing", center: imgPos, cur: imgPos }); return; }

    if (tool === "count") {
      if (draw.phase === "count-drawing") {
        if (countFinishAction === "double-click") {
          const now = Date.now();
          if (now - lastCountClickRef.current < 300 && draw.pts.length >= 1) {
            lastCountClickRef.current = 0;
            setDraw({ phase: "count-pending", pts: draw.pts, pos: imgPos });
            return;
          }
          lastCountClickRef.current = now;
        }
        setDraw({ ...draw, pts: [...draw.pts, imgPos] });
      } else {
        if (countFinishAction === "double-click") lastCountClickRef.current = Date.now();
        setDraw({ phase: "count-drawing", pts: [imgPos], cur: imgPos });
      }
      return;
    }
  }, [shouldPan, readonly, tool, draw, getImagePos, scale, stagePos, polylineFinishAction, countFinishAction]);

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

    if (marquee) {
      setMarquee({ ...marquee, cur: imgPos });
      return;
    }

    if (draw.phase === "bbox-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "polygon-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "polyline-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "line-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "circle-drawing") setDraw({ ...draw, cur: imgPos });
    if (draw.phase === "count-drawing") setDraw({ ...draw, cur: imgPos });

    if (draggingAnnotation) {
      const dx = imgPos[0] - draggingAnnotation.startImg[0];
      const dy = imgPos[1] - draggingAnnotation.startImg[1];
      // Move all selected annotations when dragging one that belongs to the selection
      const idsToMove = selectedIds.includes(draggingAnnotation.id) ? selectedIds : [draggingAnnotation.id];
      if (idsToMove.length === 1) {
        dispatch({ type: "MOVE", id: idsToMove[0]!, delta: [dx, dy] });
      } else {
        dispatch({ type: "MOVE_MANY", ids: idsToMove, delta: [dx, dy] });
      }
      setDraggingAnnotation({ ...draggingAnnotation, startImg: imgPos });
    }

    if (draggingHandle) {
      const ann = annotationsRef.current.find((a) => a.id === draggingHandle.annId);
      if (ann) {
        if (ann.type === "circle") {
          const { x, y, w } = bboxToKonva(ann.points);
          const cx = x + w / 2, cy = y + w / 2;
          const r = Math.max(4, Math.hypot(imgPos[0] - cx, imgPos[1] - cy));
          dispatch({ type: "UPDATE", payload: { ...ann, points: [[cx - r, cy - r], [cx + r, cy + r]] } });
        } else {
          const dx = imgPos[0] - draggingHandle.startImg[0];
          const dy = imgPos[1] - draggingHandle.startImg[1];
          const { x, y, w, h } = bboxToKonva(ann.points);
          const handle = bboxHandles(x, y, w, h)[draggingHandle.handleIdx];
          if (handle) {
            dispatch({ type: "UPDATE", payload: { ...ann, points: handle.resizeFn(dx, dy, ann.points as [[number,number],[number,number]]) } });
          }
        }
        setDraggingHandle({ ...draggingHandle, startImg: imgPos });
      }
    }

    if (draggingVertex) {
      const ann = annotationsRef.current.find((a) => a.id === draggingVertex.annId);
      if (ann) {
        dispatch({ type: "UPDATE", payload: { ...ann, points: ann.points.map((p, i) => i === draggingVertex.vertIdx ? imgPos : p) as [number,number][] } });
        setDraggingVertex({ ...draggingVertex, startImg: imgPos });
      }
    }
  }, [draw, stagePos, scale, draggingAnnotation, draggingHandle, draggingVertex, selectedIds, dispatch, marquee]);

  const handleStageMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (panStart.current) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }

    if (marquee) {
      const box = bboxToKonva([marquee.start, marquee.cur]);
      const dragged = box.w > 4 || box.h > 4;
      if (!dragged) {
        if (!marquee.additive) setSelectedIds([]);
      } else {
        const hits = annotationsRef.current
          .filter((ann) => boxesIntersect(box, getAnnotationBounds(ann)))
          .map((ann) => ann.id);
        if (marquee.additive) {
          setSelectedIds((prev) => [...new Set([...prev, ...hits])]);
        } else {
          setSelectedIds(hits);
        }
      }
      setMarquee(null);
      return;
    }

    if (readonly) return;
    const imgPos = getImagePos(e);
    if (draw.phase === "bbox-drawing") {
      const { w, h } = bboxToKonva([draw.start, imgPos]);
      if (w < 8 || h < 8) { setDraw({ phase: "idle" }); return; }
      setDraw({ phase: "bbox-pending", points: [draw.start, imgPos], pos: imgPos });
    }
    if (draw.phase === "circle-drawing") {
      const r = Math.hypot(imgPos[0] - draw.center[0], imgPos[1] - draw.center[1]);
      if (r < 4) { setDraw({ phase: "idle" }); return; }
      const [cx, cy] = draw.center;
      setDraw({ phase: "circle-pending", points: [[cx - r, cy - r], [cx + r, cy + r]], pos: imgPos });
    }
    setDraggingAnnotation(null);
    setDraggingHandle(null);
    setDraggingVertex(null);
  }, [readonly, draw, getImagePos, marquee]);

  const handleStageContextMenu = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (polylineFinishAction === "right-click" && draw.phase === "polyline-drawing" && draw.pts.length >= 2) {
      e.evt.preventDefault();
      const pos = draw.pts[draw.pts.length - 1]!;
      setDraw({ phase: "polyline-pending", pts: draw.pts, pos });
      return;
    }
    if (countFinishAction === "right-click" && draw.phase === "count-drawing" && draw.pts.length >= 1) {
      e.evt.preventDefault();
      const pos = draw.pts[draw.pts.length - 1]!;
      setDraw({ phase: "count-pending", pts: draw.pts, pos });
    }
  }, [polylineFinishAction, countFinishAction, draw]);

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
    if (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
      );
    } else if (!selectedIds.includes(id)) {
      // Plain click on an unselected annotation replaces the selection.
      setSelectedIds([id]);
    }
    // Plain click on an already-selected annotation keeps the current multi-selection
    // so the user can drag the group without collapsing it.
  }, [tool, readonly, panMode, selectedIds]);

  const handleAnnotationMouseDown = useCallback((id: string, e: KonvaEventObject<MouseEvent>) => {
    if (tool !== "select" || readonly || panMode) return;
    e.cancelBubble = true;

    // Modifier clicks toggle selection on mouse-up; don't start a drag here.
    if (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey) return;

    if (e.evt.altKey) {
      // Alt+drag: duplicate the selection (or just this annotation) and drag the copies
      const idsToClone = selectedIds.includes(id) ? selectedIds : [id];
      const copies = cloneAnnotations(idsToClone, [0, 0]);
      snapshot();
      dispatch({ type: "ADD_MANY", payload: copies });
      setSelectedIds(copies.map((c) => c.id));
      // Drag the copy that corresponds to the annotation the user grabbed
      const cloneIdx = idsToClone.indexOf(id);
      const dragId = copies[cloneIdx]?.id ?? copies[0]?.id;
      if (dragId) setDraggingAnnotation({ id: dragId, startImg: getImagePos(e) });
      return;
    }

    // Keep existing selection when clicking a selected annotation (so drag moves all)
    if (!selectedIds.includes(id)) {
      setSelectedIds([id]);
    }
    // Snapshot once here — drag moves use raw dispatch so no per-frame cloning
    snapshot();
    setDraggingAnnotation({ id, startImg: getImagePos(e) });
  }, [tool, readonly, panMode, getImagePos, selectedIds, cloneAnnotations, snapshot]);

  const commitPendingShape = useCallback((
    pendingDraw: DrawState,
    result: { label: string; symbolSize?: SymbolSize; meta?: Record<string, unknown> },
  ) => {
    const meta: Record<string, unknown> = { ...(result.meta ?? {}) };
    if (result.symbolSize) meta.symbolSize = result.symbolSize;
    const base = {
      label: result.label,
      source: "human" as const,
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
    };

    if (pendingDraw.phase === "bbox-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "bbox", points: pendingDraw.points, ...base } });
    } else if (pendingDraw.phase === "polygon-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "polygon", points: pendingDraw.pts, ...base } });
    } else if (pendingDraw.phase === "polyline-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "polyline", points: pendingDraw.pts, ...base } });
    } else if (pendingDraw.phase === "line-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "line", points: pendingDraw.points, ...base } });
    } else if (pendingDraw.phase === "point-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "point", points: [pendingDraw.pt], ...base } });
    } else if (pendingDraw.phase === "circle-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "circle", points: pendingDraw.points, ...base } });
    } else if (pendingDraw.phase === "count-pending") {
      const pts = pendingDraw.pts;
      snapshot();
      dispatch({
        type: "ADD_MANY",
        payload: pts.map((pt) => ({
          id: newId(),
          type: "point" as const,
          points: [pt] as [number, number][],
          ...base,
        })),
      });
    }
  }, [dispatch, dispatchAndNotify, snapshot]);

  const handleLabelSelect = useCallback((label: string, symbolSize?: SymbolSize) => {
    const meta = symbolSize ? { symbolSize } : undefined;
    const base = { label, source: "human" as const, ...(meta ? { meta } : {}) };
    if (draw.phase === "bbox-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "bbox", points: draw.points, ...base } });
    } else if (draw.phase === "polygon-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "polygon", points: draw.pts, ...base } });
    } else if (draw.phase === "polyline-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "polyline", points: draw.pts, ...base } });
    } else if (draw.phase === "line-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "line", points: draw.points, ...base } });
    } else if (draw.phase === "point-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "point", points: [draw.pt], ...base } });
    } else if (draw.phase === "circle-pending") {
      dispatchAndNotify({ type: "ADD", payload: { id: newId(), type: "circle", points: draw.points, ...base } });
    } else if (draw.phase === "count-pending") {
      const pts = draw.pts;
      snapshot();
      dispatch({ type: "ADD_MANY", payload: pts.map((pt) => ({ id: newId(), type: "point" as const, points: [pt] as [number, number][], ...base })) });
    }
    setDraw({ phase: "idle" });
  }, [draw, dispatchAndNotify, snapshot]);

  const shapeCommitSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onPendingShapeCommit || !isPendingShapePhase(draw.phase)) {
      if (!isPendingShapePhase(draw.phase)) {
        shapeCommitSessionRef.current = null;
      }
      return;
    }

    const capturedDraw = draw;
    const pos = (capturedDraw as { pos: [number, number] }).pos;
    const sessionId = `${draw.phase}:${pos[0]},${pos[1]}`;
    if (shapeCommitSessionRef.current === sessionId) return;
    shapeCommitSessionRef.current = sessionId;

    const phase = capturedDraw.phase;
    const geometryType = phase.replace(/-pending$/, "");

    void onPendingShapeCommit({
      geometryType,
      phase,
      position: { x: pos[0], y: pos[1] },
    }).then((result) => {
      shapeCommitSessionRef.current = null;
      if (!isPendingShapePhase(phase) || capturedDraw.phase !== phase) return;

      if (!result) {
        setDraw({ phase: "idle" });
        return;
      }

      commitPendingShape(capturedDraw, result);
      setDraw({ phase: "idle" });
    });
  }, [draw, onPendingShapeCommit, commitPendingShape]);

  const applyRelabel = useCallback((annId: string, label: string, symbolSize?: SymbolSize) => {
    const ann = annotations.find((a) => a.id === annId);
    if (!ann) return;
    const nextMeta = { ...ann.meta };
    if (symbolSize) nextMeta.symbolSize = symbolSize;
    else delete nextMeta.symbolSize;
    const hasMeta = Object.keys(nextMeta).length > 0;
    const { meta: _prevMeta, ...rest } = ann;
    dispatchAndNotify({
      type: "UPDATE",
      payload: {
        ...rest,
        label,
        ...(hasMeta ? { meta: nextMeta } : {}),
      },
    });
  }, [annotations, dispatchAndNotify]);

  const handlePopoverCancel = useCallback(() => setDraw({ phase: "idle" }), []);

  const handleCreateLabel = useCallback((displayName: string): string => {
    const base = slugify(displayName);
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
    if (!["bbox-pending","polygon-pending","polyline-pending","line-pending","point-pending","circle-pending","count-pending"].includes(draw.phase)) return null;
    const pos = (draw as { pos: [number,number] }).pos;
    return { x: pos[0] * scale + stagePos.x, y: pos[1] * scale + stagePos.y };
  };

  const pPos = popoverPos();

  const dimensionContext =
    dpi !== undefined && drawingScale
      ? { dpi, drawingScale }
      : undefined;

  // Screen position for the relabel popover — top-left corner of the annotation
  const relabelPos = (() => {
    if (!relabelId) return null;
    const ann = annotations.find((a) => a.id === relabelId);
    if (!ann) return null;
    let imgX: number, imgY: number;
    if (ann.type === "bbox" || ann.type === "circle") {
      imgX = Math.min(ann.points[0]![0], ann.points[1]![0]);
      imgY = Math.min(ann.points[0]![1], ann.points[1]![1]);
    } else if (ann.type === "point") {
      imgX = ann.points[0]![0];
      imgY = ann.points[0]![1];
    } else {
      const c = centroid(ann.points);
      imgX = c[0]; imgY = c[1];
    }
    return { x: imgX * scale + stagePos.x, y: imgY * scale + stagePos.y };
  })();

  // Detect when the image is scrolled/panned entirely out of view
  const imageOutOfView = img != null && (
    stagePos.x + img.width * scale < 0 ||
    stagePos.x > containerSize.w ||
    stagePos.y + img.height * scale < 0 ||
    stagePos.y > containerSize.h
  );

  const stageCursor = isPanning ? "grabbing"
    : panMode ? "grab"
    : spaceDown ? "grab"
    : tool === "select" && !readonly ? "crosshair"
    : tool === "select" ? "default"
    : "crosshair";

  // ---------------------------------------------------------------------------
  // Render annotations
  // ---------------------------------------------------------------------------

  const renderAnnotation = (ann: CanonicalAnnotation) => {
    const lm = labels.find((l) => l.canonicalClassId === ann.label);
    const color = lm?.color ?? "#ffffff";
    const isSelected = selectedIds.includes(ann.id);
    const isHovered = hoveredId === ann.id;
    const isEngine = ann.source === "engine";
    // Show resize/vertex handles only when exactly this annotation is selected alone
    const showHandles = isSelected && selectedIds.length === 1;

    const baseStrokeWidth = isEngine ? 1.5 : 2;
    const strokeWidth = isSelected ? 2 : isHovered ? 2.5 : baseStrokeWidth;
    const opacity = isEngine ? 0.85 : 1.0;
    const shapeMeta = ann.meta as ShapeMeta | undefined;
    const isHollowFill = shapeMeta?.hollow === true;
    const fillAlpha = isHollowFill ? 0 : isSelected ? 0.18 : isHovered ? 0.15 : isEngine ? 0.08 : 0.12;
    const rings = getAnnotationRings(ann);
    const hasHoles = (shapeMeta?.rings?.length ?? 0) > 1;

    const renderCompoundArea = (strokeProps: typeof commonProps) => (
      <Shape
        {...strokeProps}
        fill={hexToRgba(color, fillAlpha)}
        fillEnabled={!isHollowFill}
        fillRule="evenodd"
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          for (const ring of rings) {
            ring.forEach(([x, y], i) => {
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.closePath();
          }
          ctx.fillStrokeShape(shape);
        }}
        hitFunc={(ctx, shape) => {
          ctx.beginPath();
          for (const ring of rings) {
            ring.forEach(([x, y], i) => {
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.closePath();
          }
          ctx.fillStrokeShape(shape);
        }}
      />
    );

    const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
      if (tool !== "select" || readonly) return;
      e.cancelBubble = true;
      setSelectedIds([ann.id]);
      setRelabelId(ann.id);
    };

    const commonProps = {
      stroke: color,
      strokeWidth: strokeWidth / scale,
      opacity,
      onClick: (e: KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann.id, e),
      onMouseDown: (e: KonvaEventObject<MouseEvent>) => handleAnnotationMouseDown(ann.id, e),
      onDblClick: handleDblClick,
      onMouseEnter: () => setHoveredId(ann.id),
      onMouseLeave: () => setHoveredId(null),
    };

    // "always" respects the 30% zoom floor (unreadable below that).
    // Interactive modes show on demand regardless of zoom level.
    const chipVisible =
      labelVisibility === "always" ? scale >= 0.3
      : labelVisibility === "hover" ? isHovered
      : labelVisibility === "selected" ? isSelected
      : /* "hover+selected" */ isHovered || isSelected;
    let chipX = 0, chipY = 0;
    if (ann.type === "bbox" || ann.type === "circle") {
      chipX = Math.min(ann.points[0]![0], ann.points[1]![0]);
      chipY = Math.min(ann.points[0]![1], ann.points[1]![1]) - 16 / scale;
    } else if (ann.type === "polygon" || ann.type === "polyline" || ann.type === "line") {
      const c = centroid(ann.points);
      chipX = c[0]; chipY = c[1];
    } else if (ann.type === "point") {
      chipX = ann.points[0]![0] + 10 / scale;
      chipY = ann.points[0]![1] - 8 / scale;
    }

    const chipLabel = lm?.displayName ?? ann.label;
    const chipConf = ann.confidence !== undefined ? ` ${Math.round(ann.confidence * 100)}%` : "";
    const symbolSize = parseSymbolSize(ann.meta);
    const chipSymbolSize = symbolSize ? ` ${formatSymbolSize(symbolSize)}` : "";
    const calculatedSize = formatAnnotationCalculatedSize(ann, dpi, drawingScale);
    const chipDim = calculatedSize ? ` ${calculatedSize}` : "";

    const chipText = chipLabel + chipConf + chipSymbolSize + chipDim;
    // 8px per char is a safe overestimate for mixed system-ui + monospace content
    const chipWidth = chipText.length * 8 / scale + 12 / scale;

    const chip = chipVisible ? (
      <Group x={chipX} y={chipY}>
        <Rect
          width={chipWidth}
          height={18 / scale}
          fill={hexToRgba(resolved.bgElevated, 0.9)}
          stroke={hexToRgba(resolved.accent, 0.45)}
          strokeWidth={1 / scale}
          cornerRadius={4 / scale}
        />
        <Circle x={6 / scale} y={9 / scale} radius={3 / scale} fill={color} />
        <Text x={12 / scale} y={3 / scale} text={chipText} fontSize={11 / scale} fill={resolved.textPrimary} fontFamily="system-ui" />
      </Group>
    ) : null;

    if (ann.type === "bbox") {
      const { x, y, w, h } = bboxToKonva(ann.points);
      if (hasHoles) {
        return (
          <Group key={ann.id}>
            {renderCompoundArea(commonProps)}
            {chip}
          </Group>
        );
      }
      return (
        <Group key={ann.id}>
          <Rect x={x} y={y} width={w} height={h} fill={hexToRgba(color, fillAlpha)} fillEnabled={!isHollowFill} {...commonProps} />
          {showHandles && bboxHandles(x, y, w, h).map((handle, i) => (
            <Circle key={i} x={handle.pos[0]} y={handle.pos[1]}
              radius={HANDLE_RADIUS / scale} fill={resolved.handleFill} stroke={color} strokeWidth={2 / scale}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                snapshot();
                setDraggingHandle({ annId: ann.id, handleIdx: i, startImg: getImagePos(e) });
              }}
            />
          ))}
          {chip}
        </Group>
      );
    }

    if (ann.type === "circle") {
      const { x, y, w } = bboxToKonva(ann.points);
      const cx = x + w / 2, cy = y + w / 2, r = w / 2;
      if (hasHoles) {
        return (
          <Group key={ann.id}>
            {renderCompoundArea(commonProps)}
            {chip}
          </Group>
        );
      }
      return (
        <Group key={ann.id}>
          <Ellipse x={cx} y={cy} radiusX={r} radiusY={r} fill={hexToRgba(color, fillAlpha)} fillEnabled={!isHollowFill} {...commonProps} />
          {showHandles && ([
            [cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy],
          ] as [number, number][]).map(([hx, hy], i) => (
            <Circle key={i} x={hx} y={hy}
              radius={HANDLE_RADIUS / scale} fill={resolved.handleFill} stroke={color} strokeWidth={2 / scale}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                snapshot();
                setDraggingHandle({ annId: ann.id, handleIdx: i, startImg: getImagePos(e) });
              }}
            />
          ))}
          {chip}
        </Group>
      );
    }

    if (ann.type === "polygon") {
      if (hasHoles) {
        return (
          <Group key={ann.id}>
            {renderCompoundArea(commonProps)}
            {showHandles && rings[0]?.map(([x, y], i) => (
              <Circle key={i} x={x} y={y} radius={VERTEX_RADIUS / scale} fill={resolved.handleFill} stroke={color} strokeWidth={1.5 / scale}
                onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true;
                  snapshot();
                  setDraggingVertex({ annId: ann.id, vertIdx: i, startImg: getImagePos(e) });
                }}
              />
            ))}
            {chip}
          </Group>
        );
      }
      return (
        <Group key={ann.id}>
          <Line points={ann.points.flatMap(([x, y]) => [x, y])} closed fill={hexToRgba(color, fillAlpha)} fillEnabled={!isHollowFill} {...commonProps} />
          {showHandles && ann.points.map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={VERTEX_RADIUS / scale} fill={resolved.handleFill} stroke={color} strokeWidth={1.5 / scale}
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

    if (ann.type === "line" || ann.type === "polyline") {
      return (
        <Group key={ann.id}>
          <Line points={ann.points.flatMap(([x, y]) => [x, y])} hitStrokeWidth={10 / scale} {...commonProps} />
          {showHandles && ann.points.map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={HANDLE_RADIUS / scale} fill={resolved.handleFill} stroke={color} strokeWidth={2 / scale}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                snapshot();
                setDraggingVertex({ annId: ann.id, vertIdx: i, startImg: getImagePos(e) });
              }}
            />
          ))}
          {showHandles && ann.points.slice(0, -1).map(([x1, y1], i) => {
            const [x2, y2] = ann.points[i + 1]!;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <Circle key={`mid-${i}`} x={mx} y={my}
                radius={(HANDLE_RADIUS * 0.65) / scale}
                fill={resolved.accent}
                stroke={resolved.handleFill}
                strokeWidth={1.5 / scale}
                opacity={0.85}
                onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true;
                  const newPts: [number, number][] = [...ann.points];
                  newPts.splice(i + 1, 0, [mx, my]);
                  const updated: CanonicalAnnotation = {
                    ...ann,
                    type: ann.type === "line" ? "polyline" : ann.type,
                    points: newPts,
                  };
                  // Sync ref immediately so the drag handler sees the new vertex on the same frame
                  annotationsRef.current = annotationsRef.current.map((a) => a.id === ann.id ? updated : a);
                  dispatchAndNotify({ type: "UPDATE", payload: updated });
                  setDraggingVertex({ annId: ann.id, vertIdx: i + 1, startImg: [mx, my] });
                }}
              />
            );
          })}
          {chip}
        </Group>
      );
    }

    if (ann.type === "point") {
      const [x, y] = ann.points[0]!;
      return (
        <Group key={ann.id}>
          <Circle x={x} y={y} radius={8 / scale} fill={color} stroke={resolved.handleFill} strokeWidth={2 / scale} opacity={opacity}
            onClick={(e: KonvaEventObject<MouseEvent>) => handleAnnotationClick(ann.id, e)}
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => handleAnnotationMouseDown(ann.id, e)}
            onDblClick={handleDblClick}
            onMouseEnter={() => setHoveredId(ann.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
          {chip}
        </Group>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // In-progress drawing overlays
  // ---------------------------------------------------------------------------

  const renderDraw = () => {
    if (marquee) {
      const { x, y, w, h } = bboxToKonva([marquee.start, marquee.cur]);
      return (
        <Rect
          x={x} y={y} width={w} height={h}
          stroke={resolved.accent}
          strokeWidth={1.5 / scale}
          fill={resolved.selection}
          dash={[4 / scale, 4 / scale]}
          listening={false}
        />
      );
    }

    if (draw.phase === "bbox-drawing") {
      const { x, y, w, h } = bboxToKonva([draw.start, draw.cur]);
      return <Rect x={x} y={y} width={w} height={h} stroke={resolved.accent} strokeWidth={1.5 / scale} fill={hexToRgba(resolved.accent, 0.1)} dash={[4 / scale, 4 / scale]} />;
    }

    if (draw.phase === "polygon-drawing" && draw.pts.length > 0) {
      const flat = draw.pts.flatMap(([x, y]) => [x, y]);
      const lastPt = draw.pts[draw.pts.length - 1]!;
      const firstPt = draw.pts[0]!;
      const dx = firstPt[0] - draw.cur[0], dy = firstPt[1] - draw.cur[1];
      const nearFirst = draw.pts.length >= 3 && (dx * dx + dy * dy) * scale * scale < CLOSE_DIST * CLOSE_DIST;
      return (
        <Group>
          {draw.pts.length > 1 && <Line points={flat} stroke={resolved.accent} strokeWidth={1.5 / scale} />}
          <Line points={[lastPt[0], lastPt[1], draw.cur[0], draw.cur[1]]} stroke={resolved.accent} strokeWidth={1.5 / scale} dash={[4 / scale, 4 / scale]} />
          {draw.pts.map(([x, y], i) => <Circle key={i} x={x} y={y} radius={4 / scale} fill={resolved.handleFill} stroke={resolved.accent} strokeWidth={1 / scale} />)}
          {nearFirst && <Circle x={firstPt[0]} y={firstPt[1]} radius={6 / scale} fill={resolved.success} opacity={0.7} />}
        </Group>
      );
    }

    if (draw.phase === "polyline-drawing" && draw.pts.length > 0) {
      const flat = draw.pts.flatMap(([x, y]) => [x, y]);
      const lastPt = draw.pts[draw.pts.length - 1]!;
      const finishLabel =
        polylineFinishAction === "right-click" ? "Right-click" :
        polylineFinishAction === "double-click" ? "Double-click" :
        "Enter";
      const hint = draw.pts.length >= 2 ? `${finishLabel} to finish · Esc to cancel` : "Click to add points · Esc to cancel";
      const hintWidth = hint.length * 7 / scale + 12 / scale;
      return (
        <Group>
          {draw.pts.length > 1 && <Line points={flat} stroke={resolved.accent} strokeWidth={1.5 / scale} />}
          <Line points={[lastPt[0], lastPt[1], draw.cur[0], draw.cur[1]]} stroke={resolved.accent} strokeWidth={1.5 / scale} dash={[4 / scale, 4 / scale]} />
          {draw.pts.map(([x, y], i) => <Circle key={i} x={x} y={y} radius={4 / scale} fill={resolved.handleFill} stroke={resolved.accent} strokeWidth={1 / scale} />)}
          <Group x={draw.cur[0] + 10 / scale} y={draw.cur[1] + 10 / scale}>
            <Rect
              width={hintWidth}
              height={18 / scale}
              fill={hexToRgba(resolved.bgElevated, 0.9)}
              stroke={hexToRgba(resolved.accent, 0.45)}
              strokeWidth={1 / scale}
              cornerRadius={4 / scale}
            />
            <Text x={6 / scale} y={3 / scale} text={hint} fontSize={11 / scale} fill={resolved.textPrimary} fontFamily="system-ui" />
          </Group>
        </Group>
      );
    }

    if (draw.phase === "line-drawing") {
      return <Line points={[draw.start[0], draw.start[1], draw.cur[0], draw.cur[1]]} stroke={resolved.accent} strokeWidth={1.5 / scale} dash={[4 / scale, 4 / scale]} />;
    }

    if (draw.phase === "circle-drawing") {
      const r = Math.hypot(draw.cur[0] - draw.center[0], draw.cur[1] - draw.center[1]);
      return (
        <Group>
          <Ellipse x={draw.center[0]} y={draw.center[1]} radiusX={r} radiusY={r}
            stroke={resolved.accent} strokeWidth={1.5 / scale} fill={hexToRgba(resolved.accent, 0.1)} dash={[4 / scale, 4 / scale]} />
          <Circle x={draw.center[0]} y={draw.center[1]} radius={3 / scale} fill={resolved.accent} />
        </Group>
      );
    }

    if (draw.phase === "count-drawing" && draw.pts.length > 0) {
      const finishLabel =
        countFinishAction === "right-click" ? "Right-click" :
        countFinishAction === "double-click" ? "Double-click" :
        "Enter";
      const countText = `${draw.pts.length} pt${draw.pts.length !== 1 ? "s" : ""} · ${finishLabel} to finish · Esc to cancel`;
      const hintWidth = countText.length * 7 / scale + 12 / scale;
      return (
        <Group>
          {draw.pts.map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={8 / scale} fill={resolved.accent} stroke={resolved.handleFill} strokeWidth={2 / scale} opacity={0.85} />
          ))}
          <Group x={draw.cur[0] + 10 / scale} y={draw.cur[1] + 10 / scale}>
            <Rect width={hintWidth} height={18 / scale} fill={hexToRgba(resolved.bgElevated, 0.9)} stroke={hexToRgba(resolved.accent, 0.45)} strokeWidth={1 / scale} cornerRadius={4 / scale} />
            <Text x={6 / scale} y={3 / scale} text={countText} fontSize={11 / scale} fill={resolved.textPrimary} fontFamily="system-ui" />
          </Group>
        </Group>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  const availableTools = tools ?? (["select", "bbox", "polygon", "polyline", "line", "point", "circle", "count"] as ToolType[]);
  const selectedAreaCount = selectedIds
    .map((id) => annotations.find((a) => a.id === id))
    .filter((a): a is CanonicalAnnotation => a != null && isAreaAnnotation(a)).length;
  const singleSelected = selectedIds.length === 1 ? annotations.find((a) => a.id === selectedIds[0]) : undefined;
  const singleIsHollow = (singleSelected?.meta as ShapeMeta | undefined)?.hollow === true;

  const cssVars = themeToCssVars(resolved) as React.CSSProperties;

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "var(--ae-bg-base)", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", fontSize: 13, color: "var(--ae-text-primary)", overflow: "hidden", ...cssVars }} className={className ?? ""}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Toolbar
          tools={availableTools}
          activeTool={tool}
          panMode={panMode}
          onToolChange={(t) => { setPanMode(false); setTool(t); setDraw({ phase: "idle" }); }}
          onPanModeChange={setPanMode}
          readonly={readonly}
          width={resolved.toolbarWidth}
          showUndoRedo={showUndoRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
        <div ref={containerRef} style={{ flex: 1, background: "var(--ae-bg-canvas)", position: "relative", overflow: "hidden", cursor: stageCursor }}>
          {!readonly && (
            <ShapeOpsBar
              count={selectedIds.length}
              areaCount={selectedAreaCount}
              canLayer={selectedIds.length === 1}
              readonly={readonly}
              isHollow={singleIsHollow}
              onMerge={handleMerge}
              onSubtract={handleSubtract}
              onIntersect={handleIntersect}
              onHollow={handleCutHole}
              onToggleFill={handleToggleFill}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
            />
          )}
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
            onContextMenu={handleStageContextMenu as (e: KonvaEventObject<Event>) => void}
            onWheel={handleWheel}
            listening={true}
          >
            <Layer>
              {img && <KonvaImage image={img} x={0} y={0} width={img.width} height={img.height} name="bg-image" />}
              {annotations.map(renderAnnotation)}
              {renderDraw()}
            </Layer>
          </Stage>
          {imageOutOfView && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
              <button
                onClick={fitToScreen}
                style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "var(--ae-bg-surface)", border: "1px solid var(--ae-border)", borderRadius: 8, color: "var(--ae-text-primary)", fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", fontFamily: "inherit" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/>
                </svg>
                Reset View
              </button>
            </div>
          )}
          {pPos && !onPendingShapeCommit && (
            <LabelPopover
              labels={labels}
              position={pPos}
              onSelect={handleLabelSelect}
              onCancel={handlePopoverCancel}
              onCreateLabel={readonly ? undefined : handleCreateLabel}
            />
          )}
          {relabelPos && !pPos && (() => {
            const relabelAnn = annotations.find((a) => a.id === relabelId);
            const initialSize = parseSymbolSize(relabelAnn?.meta);
            return (
              <LabelPopover
                labels={labels}
                position={relabelPos}
                {...(initialSize ? { initialSymbolSize: initialSize } : {})}
                onSelect={(label, symbolSize) => {
                  if (relabelId) applyRelabel(relabelId, label, symbolSize);
                  setRelabelId(null);
                }}
                onCancel={() => setRelabelId(null)}
                onCreateLabel={readonly ? undefined : handleCreateLabel}
              />
            );
          })()}
        </div>
        <LabelPanel
          annotations={annotations}
          labels={labels}
          selectedIds={selectedIds}
          readonly={readonly}
          {...(dimensionContext ? { dimensionContext } : {})}
          onCreateLabel={readonly ? undefined : handleCreateLabel}
          width={resolved.panelWidth}
          height={containerSize.h}
          onSelect={(id, additive) => {
            if (additive) {
              setSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
              );
            } else {
              setSelectedIds([id]);
            }
            const ann = annotations.find((a) => a.id === id);
            if (!ann) return;
            const c = ann.type === "point" ? ann.points[0]! : centroid(ann.points);
            const sx = c[0] * scale + stagePos.x;
            const sy = c[1] * scale + stagePos.y;
            if (sx < 0 || sx > containerSize.w || sy < 0 || sy > containerSize.h) {
              setStagePos({ x: containerSize.w / 2 - c[0] * scale, y: containerSize.h / 2 - c[1] * scale });
            }
          }}
          onDelete={(id) => {
            dispatchAndNotify({ type: "DELETE", id });
            setSelectedIds((prev) => prev.filter((sid) => sid !== id));
          }}
          onDeleteSelected={() => {
            if (selectedIds.length === 0 || readonly) return;
            if (selectedIds.length === 1) {
              dispatchAndNotify({ type: "DELETE", id: selectedIds[0]! });
            } else {
              dispatchAndNotify({ type: "DELETE_MANY", ids: selectedIds });
            }
            setSelectedIds([]);
          }}
          onRelabel={(id, label, symbolSize) => applyRelabel(id, label, symbolSize)}
        />
      </div>

      {/* Status bar */}
      <div style={{ height: resolved.statusBarHeight, background: "var(--ae-bg-surface)", borderTop: "1px solid var(--ae-border)", display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between", fontSize: 11, color: "var(--ae-text-secondary)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Zoom: <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{Math.round(scale * 100)}%</span></span>
          {showZoomControls && (
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button title="Fit to screen (Ctrl+0)" onClick={fitToScreen} style={zoomBtnStyle}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-primary)"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-secondary)"; }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/></svg>
              </button>
              <button title="Zoom out (Ctrl+-)" onClick={() => setScale((s) => Math.max(s / 1.2, MIN_ZOOM))} style={zoomBtnStyle}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-primary)"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-secondary)"; }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/><line x1="4.5" y1="7" x2="9.5" y2="7"/></svg>
              </button>
              <button title="Zoom in (Ctrl+=)" onClick={() => setScale((s) => Math.min(s * 1.2, MAX_ZOOM))} style={zoomBtnStyle}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-primary)"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-secondary)"; }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/><line x1="7" y1="4.5" x2="7" y2="9.5"/><line x1="4.5" y1="7" x2="9.5" y2="7"/></svg>
              </button>
            </div>
          )}

          {/* Drawing scale display / editor */}
          {!scaleEditing && (dpi || drawingScale) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, borderLeft: "1px solid var(--ae-border)", paddingLeft: 8 }}>
              <span style={{ color: "var(--ae-text-muted)" }}>Scale:</span>
              <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
                {drawingScale ? drawingScale.label : "—"}
                {dpi ? ` · ${dpi} DPI` : ""}
              </span>
              {!readonly && (
                <button title="Edit drawing scale" onClick={() => setScaleEditing(true)} style={{ ...zoomBtnStyle, width: 16, height: 16 }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-primary)"; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-secondary)"; }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2.12 2.12 0 0 1 3 3L5 14l-4 1 1-4Z"/></svg>
                </button>
              )}
            </div>
          )}
          {scaleEditing && (
            <DrawingScaleEditor
              initialScale={drawingScale}
              onConfirm={(next) => {
                setDrawingScale(next);
                onDrawingScaleChange?.(next);
                setScaleEditing(false);
              }}
              onCancel={() => setScaleEditing(false)}
            />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedIds.length > 0 && (
            <span>
              {selectedIds.length} selected
              {!readonly && selectedIds.length > 1 && (
                <span style={{ color: "var(--ae-text-muted)" }}> · Del to delete</span>
              )}
            </span>
          )}
          <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>x: {Math.round(cursorImg[0])} y: {Math.round(cursorImg[1])}</span>
          {showFullscreen && (
            <button
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
              style={zoomBtnStyle}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-primary)"; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-secondary)"; }}
            >
              {isFullscreen
                ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1v4H1M11 1v4h4M1 11h4v4M11 11h4v4"/></svg>
                : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/></svg>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

