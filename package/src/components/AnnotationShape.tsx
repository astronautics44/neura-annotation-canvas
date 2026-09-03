"use client";

import React from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Ellipse, Group, Line, Rect, Shape } from "react-konva";
import type { CanonicalAnnotation } from "../types/canonical";
import type { ThemeVars } from "../theme";
import type { DrawingScale } from "../utils/drawingScale";
import { getAnnotationRings, type ShapeMeta } from "../utils/booleanOps";
import { formatSymbolSize, parseSymbolSize } from "../utils/symbolSize";
import { formatAnnotationCalculatedSize } from "../utils/dimensions";
import { hexToRgba, bboxToKonva, centroid, bboxHandles, nearestPointOnSegment } from "./canvasHelpers";
import { HANDLE_RADIUS, VERTEX_RADIUS, POINT_RADIUS } from "./canvasConstants";
import { AnnotationChip } from "./AnnotationChip";
import { AnnotationCard } from "./AnnotationCard";
import { ScreenSpace } from "./ScreenSpace";

/**
 * One annotation, memoised.
 *
 * Every shape used to be built inside the canvas's own render, so a change to
 * anything on that component — a hover, a selection, the settled viewport —
 * rebuilt all of them. Hover is the case that hurt: the pointer crossing a
 * drawing carrying a couple of hundred marks changes `hoveredId` continually,
 * and panning drags the pointer across marks by definition. Measured on a
 * takeoff of 186 marks, one hover change cost 19 ms of that, which is two
 * frames gone on a 120 Hz display for a shape whose own appearance did not
 * change.
 *
 * Here each shape is its own memoised component, so a hover re-renders the two
 * shapes whose state actually moved. That holds only while every prop keeps its
 * identity between renders: `handlers`, `ops` and `theme` are stable by
 * construction on the canvas, and everything else here is a primitive.
 */

/** Where a label chip sits relative to its mark, in screen pixels. */
const BBOX_CHIP_OFFSET = { dx: 0, dy: -16 };
const POINT_CHIP_OFFSET = { dx: 10, dy: -8 };
const SELECTION_GLOW_PX = 16;
const EDGE_HIT_WIDTH = 12;
const LINE_HIT_WIDTH = 10;
const ENGINE_OPACITY = 0.85;
const HOVER_STROKE_WIDTH = 2.5;
const ENGINE_STROKE_WIDTH = 1.5;
const HUMAN_STROKE_WIDTH = 2;
const OVERLAY_MIN_SCALE = 0.3;
const FILL_ALPHA = { selected: 0.18, hovered: 0.15, engine: 0.08, human: 0.12 };

export type LabelVisibility = "always" | "hover" | "selected" | "hover+selected" | "never";
export type LabelDisplayMode = "chip" | "card";
export type EdgeSplitMode = "midpoint" | "anyPoint";

/** The five events every annotation answers, held stable for the shape's life. */
export interface AnnotationHandlers {
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  onDblClick: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * What a shape needs to do to the canvas, as one object whose identity never
 * changes. A shape holding a fresh copy of these on each render would defeat
 * the memo, so the canvas builds this once and dispatches through a ref.
 */
export interface ShapeOps {
  snapshot: () => void;
  imagePosOf: (e: KonvaEventObject<MouseEvent>) => [number, number];
  beginHandleDrag: (annId: string, handleIdx: number, startImg: [number, number]) => void;
  beginVertexDrag: (annId: string, vertIdx: number, startImg: [number, number]) => void;
  splitEdgeAt: (ann: CanonicalAnnotation, segIdx: number, pos: [number, number]) => void;
  deleteVertex: (ann: CanonicalAnnotation, vertIdx: number) => void;
  deleteBboxCorner: (ann: CanonicalAnnotation, cornerIdx: number) => void;
  hoverEdge: (hover: { annId: string; segIdx: number; pos: [number, number] } | null) => void;
}

interface AnnotationShapeProps {
  ann: CanonicalAnnotation;
  /** The class's colour and name, resolved by the canvas from its label map. */
  color: string;
  displayName: string;
  isSelected: boolean;
  isHovered: boolean;
  /** Resize and vertex handles show only when this is the one selected shape. */
  showHandles: boolean;
  /** The stage scale React last rendered with. */
  scale: number;
  theme: ThemeVars;
  labelVisibility: LabelVisibility;
  labelDisplayMode: LabelDisplayMode;
  dpi?: number | undefined;
  drawingScale?: DrawingScale | undefined;
  imageBounds?: { width: number; height: number } | undefined;
  edgeSplitMode: EdgeSplitMode;
  /** The hovered edge, when it belongs to this shape. Null on every other shape. */
  edgeHoverSegIdx: number | null;
  edgeHoverPos: [number, number] | null;
  handlers: AnnotationHandlers;
  ops: ShapeOps;
}

function AnnotationShapeImpl({
  ann,
  color,
  displayName,
  isSelected,
  isHovered,
  showHandles,
  scale,
  theme,
  labelVisibility,
  labelDisplayMode,
  dpi,
  drawingScale,
  imageBounds,
  edgeSplitMode,
  edgeHoverSegIdx,
  edgeHoverPos,
  handlers,
  ops,
}: AnnotationShapeProps) {
  const isEngine = ann.source === "engine";
  const baseStrokeWidth = isEngine ? ENGINE_STROKE_WIDTH : HUMAN_STROKE_WIDTH;
  // Selection is signalled by the accent glow (selectionGlow) + fill, not by a
  // thicker stroke — keep the stroke at its base/hover width.
  const strokeWidth = isHovered ? HOVER_STROKE_WIDTH : baseStrokeWidth;
  const opacity = isEngine ? ENGINE_OPACITY : 1.0;
  const shapeMeta = ann.meta as ShapeMeta | undefined;
  const isHollowFill = shapeMeta?.hollow === true;
  const fillAlpha = isHollowFill ? 0
    : isSelected ? FILL_ALPHA.selected
      : isHovered ? FILL_ALPHA.hovered
        : isEngine ? FILL_ALPHA.engine
          : FILL_ALPHA.human;
  const rings = getAnnotationRings(ann);
  const hasHoles = (shapeMeta?.rings?.length ?? 0) > 1;

  // Selected shapes get a glow ring behind the stroke so multi-selection is
  // clearly distinguishable from unselected/hovered shapes (which never glow).
  // `blur` is in the units of the node it lands on: image pixels for a shape
  // drawn in image space, screen pixels inside a `ScreenSpace` group.
  const selectionGlow = (blur: number) => isSelected
    ? {
      shadowColor: theme.accent,
      shadowBlur: blur,
      shadowOpacity: 1,
      shadowOffset: { x: 0, y: 0 },
    }
    : {};

  /*
   * Strokes are screen pixels wide at any zoom without dividing by the scale,
   * so nothing here changes when the viewport does.
   *
   * `perfectDrawEnabled` is off because every one of these has a fill, a stroke
   * and an opacity below 1, which is exactly the combination that makes Konva
   * render the shape into a throwaway buffer canvas first. On a sheet of 186
   * marks that was five sixths of the paint. What it buys is that a
   * semi-transparent fill does not show through the inner half of its own
   * stroke; at these stroke widths the difference is not visible, and a frame
   * is.
   */
  const commonProps = {
    stroke: color,
    strokeWidth,
    strokeScaleEnabled: false,
    perfectDrawEnabled: false,
    opacity,
    ...selectionGlow(SELECTION_GLOW_PX / scale),
    ...handlers,
  };

  const renderCompoundArea = () => (
    <Shape
      {...commonProps}
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

  /**
   * Edge-split handles for a selected line/polyline/polygon, honoring
   * `edgeSplitMode`. `closed` wraps the last segment back to the first point.
   */
  const renderEdgeSplitHandles = (closed: boolean) => {
    const pts = ann.points;
    const segCount = closed ? pts.length : pts.length - 1;
    const segments = Array.from({ length: segCount }, (_, i) => [pts[i]!, pts[(i + 1) % pts.length]!] as const);

    if (edgeSplitMode === "anyPoint") {
      return segments.map(([[x1, y1], [x2, y2]], i) => (
        <Group key={`edge-${i}`}>
          <Line
            points={[x1, y1, x2, y2]}
            stroke="transparent"
            strokeWidth={1}
            hitStrokeWidth={EDGE_HIT_WIDTH}
            strokeScaleEnabled={false}
            onMouseMove={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              const p = nearestPointOnSegment(ops.imagePosOf(e), [x1, y1], [x2, y2]);
              ops.hoverEdge({ annId: ann.id, segIdx: i, pos: p });
            }}
            onMouseLeave={() => ops.hoverEdge(null)}
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              const p = nearestPointOnSegment(ops.imagePosOf(e), [x1, y1], [x2, y2]);
              ops.splitEdgeAt(ann, i, p);
            }}
          />
          {edgeHoverSegIdx === i && edgeHoverPos && (
            <ScreenSpace x={edgeHoverPos[0]} y={edgeHoverPos[1]} scale={scale} listening={false}>
              <Circle
                radius={HANDLE_RADIUS * 0.65}
                fill={theme.accent} stroke={theme.handleFill} strokeWidth={1.5}
                opacity={0.85}
              />
            </ScreenSpace>
          )}
        </Group>
      ));
    }

    return segments.map(([[x1, y1], [x2, y2]], i) => {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return (
        <ScreenSpace key={`mid-${i}`} x={mx} y={my} scale={scale}>
          <Circle
            radius={HANDLE_RADIUS * 0.65}
            fill={theme.accent}
            stroke={theme.handleFill}
            strokeWidth={1.5}
            opacity={0.85}
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              ops.splitEdgeAt(ann, i, [mx, my]);
            }}
          />
        </ScreenSpace>
      );
    });
  };

  // "always" mode should show the annotation overlay like previous labels did,
  // while selected/hover modes show the overlay only on selected or hovered annotations.
  const shouldShowOverlay =
    labelVisibility === "always" ? scale >= OVERLAY_MIN_SCALE
      : labelVisibility === "selected" ? isSelected
        : labelVisibility === "hover" ? isHovered
          : labelVisibility === "hover+selected" ? isHovered || isSelected
            : false;

  const showChip = labelDisplayMode === "chip" && shouldShowOverlay;
  const showDetailCard = labelDisplayMode === "card" && shouldShowOverlay;

  // The anchor is in image pixels and the offset from it in screen pixels.
  let chipX = 0, chipY = 0;
  let chipOffset = { dx: 0, dy: 0 };
  if (ann.type === "bbox" || ann.type === "circle") {
    chipX = Math.min(ann.points[0]![0], ann.points[1]![0]);
    chipY = Math.min(ann.points[0]![1], ann.points[1]![1]);
    chipOffset = BBOX_CHIP_OFFSET;
  } else if (ann.type === "polygon" || ann.type === "polyline" || ann.type === "line") {
    const c = centroid(ann.points);
    chipX = c[0]; chipY = c[1];
  } else if (ann.type === "point") {
    chipX = ann.points[0]![0];
    chipY = ann.points[0]![1];
    chipOffset = POINT_CHIP_OFFSET;
  }

  const symbolSize = parseSymbolSize(ann.meta);
  const chipConf = ann.confidence !== undefined ? ` ${Math.round(ann.confidence * 100)}%` : "";
  const chipSymbolSize = symbolSize ? ` ${formatSymbolSize(symbolSize)}` : "";
  const calculatedSize = formatAnnotationCalculatedSize(ann, dpi, drawingScale);
  const chipDim = calculatedSize ? ` ${calculatedSize}` : "";
  const chipText = displayName + chipConf + chipSymbolSize + chipDim;

  const overlay = showChip ? (
    <AnnotationChip x={chipX} y={chipY} dx={chipOffset.dx} dy={chipOffset.dy} scale={scale} text={chipText} theme={theme} />
  ) : showDetailCard ? (
    <AnnotationCard
      ann={ann}
      anchorX={chipX}
      anchorY={chipY}
      scale={scale}
      displayName={displayName}
      theme={theme}
      dpi={dpi}
      drawingScale={drawingScale}
      imageBounds={imageBounds}
    />
  ) : null;

  if (ann.type === "bbox") {
    const { x, y, w, h } = bboxToKonva(ann.points);
    if (hasHoles) {
      return (
        <Group>
          {renderCompoundArea()}
          {overlay}
        </Group>
      );
    }
    return (
      <Group>
        <Rect x={x} y={y} width={w} height={h} fill={hexToRgba(color, fillAlpha)} fillEnabled={!isHollowFill} {...commonProps} />
        {showHandles && bboxHandles(x, y, w, h).map((handle, i) => {
          // Even indices are corners (0=TL,2=TR,4=BR,6=BL); odd are edge
          // midpoints, which aren't real vertices and can't be deleted.
          const cornerIdx = i % 2 === 0 ? i / 2 : -1;
          return (
            <ScreenSpace key={i} x={handle.pos[0]} y={handle.pos[1]} scale={scale}>
              <Circle
                radius={HANDLE_RADIUS} fill={theme.handleFill} stroke={color} strokeWidth={2}
                onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true;
                  if (e.evt.altKey && cornerIdx >= 0) { e.evt.preventDefault(); ops.deleteBboxCorner(ann, cornerIdx); return; }
                  ops.snapshot();
                  ops.beginHandleDrag(ann.id, i, ops.imagePosOf(e));
                }}
                onContextMenu={(e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true; e.evt.preventDefault();
                  if (cornerIdx >= 0) ops.deleteBboxCorner(ann, cornerIdx);
                }}
              />
            </ScreenSpace>
          );
        })}
        {overlay}
      </Group>
    );
  }

  if (ann.type === "circle") {
    const { x, y, w } = bboxToKonva(ann.points);
    const cx = x + w / 2, cy = y + w / 2, r = w / 2;
    if (hasHoles) {
      return (
        <Group>
          {renderCompoundArea()}
          {overlay}
        </Group>
      );
    }
    return (
      <Group>
        <Ellipse x={cx} y={cy} radiusX={r} radiusY={r} fill={hexToRgba(color, fillAlpha)} fillEnabled={!isHollowFill} {...commonProps} />
        {showHandles && ([
          [cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy],
        ] as [number, number][]).map(([hx, hy], i) => (
          <ScreenSpace key={i} x={hx} y={hy} scale={scale}>
            <Circle
              radius={HANDLE_RADIUS} fill={theme.handleFill} stroke={color} strokeWidth={2}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                ops.snapshot();
                ops.beginHandleDrag(ann.id, i, ops.imagePosOf(e));
              }}
            />
          </ScreenSpace>
        ))}
        {overlay}
      </Group>
    );
  }

  if (ann.type === "polygon") {
    if (hasHoles) {
      return (
        <Group>
          {renderCompoundArea()}
          {showHandles && rings[0]?.map(([x, y], i) => (
            <ScreenSpace key={i} x={x} y={y} scale={scale}>
              <Circle radius={VERTEX_RADIUS} fill={theme.handleFill} stroke={color} strokeWidth={1.5}
                onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true;
                  ops.snapshot();
                  ops.beginVertexDrag(ann.id, i, ops.imagePosOf(e));
                }}
              />
            </ScreenSpace>
          ))}
          {overlay}
        </Group>
      );
    }
    return (
      <Group>
        <Line points={ann.points.flatMap(([x, y]) => [x, y])} closed fill={hexToRgba(color, fillAlpha)} fillEnabled={!isHollowFill} {...commonProps} />
        {showHandles && renderEdgeSplitHandles(true)}
        {showHandles && ann.points.map(([x, y], i) => (
          <ScreenSpace key={i} x={x} y={y} scale={scale}>
            <Circle radius={VERTEX_RADIUS} fill={theme.handleFill} stroke={color} strokeWidth={1.5}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                if (e.evt.altKey) { e.evt.preventDefault(); ops.deleteVertex(ann, i); return; }
                ops.snapshot();
                ops.beginVertexDrag(ann.id, i, ops.imagePosOf(e));
              }}
              onContextMenu={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true; e.evt.preventDefault();
                ops.deleteVertex(ann, i);
              }}
            />
          </ScreenSpace>
        ))}
        {overlay}
      </Group>
    );
  }

  if (ann.type === "line" || ann.type === "polyline") {
    return (
      <Group>
        <Line points={ann.points.flatMap(([x, y]) => [x, y])} hitStrokeWidth={LINE_HIT_WIDTH} {...commonProps} />
        {showHandles && renderEdgeSplitHandles(false)}
        {showHandles && ann.points.map(([x, y], i) => (
          <ScreenSpace key={i} x={x} y={y} scale={scale}>
            <Circle radius={HANDLE_RADIUS} fill={theme.handleFill} stroke={color} strokeWidth={2}
              onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true;
                if (e.evt.altKey) { e.evt.preventDefault(); ops.deleteVertex(ann, i); return; }
                ops.snapshot();
                ops.beginVertexDrag(ann.id, i, ops.imagePosOf(e));
              }}
              onContextMenu={(e: KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true; e.evt.preventDefault();
                ops.deleteVertex(ann, i);
              }}
            />
          </ScreenSpace>
        ))}
        {overlay}
      </Group>
    );
  }

  if (ann.type === "point") {
    const [x, y] = ann.points[0]!;
    return (
      <Group>
        <ScreenSpace x={x} y={y} scale={scale}>
          <Circle
            radius={POINT_RADIUS}
            fill={color}
            stroke={isSelected ? theme.accent : theme.handleFill}
            strokeWidth={2}
            opacity={opacity}
            perfectDrawEnabled={false}
            {...selectionGlow(SELECTION_GLOW_PX)}
            {...handlers}
          />
        </ScreenSpace>
        {overlay}
      </Group>
    );
  }

  return null;
}

export const AnnotationShape = React.memo(AnnotationShapeImpl);
