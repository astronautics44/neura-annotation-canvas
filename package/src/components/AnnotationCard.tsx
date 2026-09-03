import React from "react";
import { Rect, Text, Line } from "react-konva";
import type { CanonicalAnnotation } from "../types/canonical";
import type { ThemeVars } from "../theme";
import type { DrawingScale } from "../utils/drawingScale";
import { hexToRgba, bboxToKonva, centroid } from "./canvasHelpers";
import { formatSymbolSize, parseSymbolSize } from "../utils/symbolSize";
import { formatAnnotationCalculatedSize } from "../utils/dimensions";
import { ScreenSpace } from "./ScreenSpace";

/** Card geometry, in screen pixels. */
const CARD_WIDTH = 180;
const CARD_PADDING = 10;
const HEADER_HEIGHT = 22;
const LINE_HEIGHT = 16;
const CARD_GAP = 8;
const EDGE_MARGIN = 4;

interface AnnotationCardProps {
  ann: CanonicalAnnotation;
  /** Chip anchor position in image-space (top-left of the annotation). */
  anchorX: number;
  anchorY: number;
  scale: number;
  displayName: string;
  theme: ThemeVars;
  dpi?: number | undefined;
  drawingScale?: DrawingScale | undefined;
  /** Image dimensions used for clamping the card inside the canvas. */
  imageBounds?: { width: number; height: number } | undefined;
}

export function AnnotationCard({
  ann,
  anchorX,
  anchorY,
  scale,
  displayName,
  theme,
  dpi,
  drawingScale,
  imageBounds,
}: AnnotationCardProps) {
  let coordValue = "";
  let sizeValue = "";
  if (ann.type === "bbox" || ann.type === "circle") {
    const { x, y, w, h } = bboxToKonva(ann.points);
    coordValue = `${Math.round(x)}, ${Math.round(y)}`;
    sizeValue = `${Math.round(w)}×${Math.round(h)}`;
  } else if (ann.type === "point") {
    const [x, y] = ann.points[0]!;
    coordValue = `${Math.round(x)}, ${Math.round(y)}`;
  } else {
    const c = centroid(ann.points);
    coordValue = `${Math.round(c[0])}, ${Math.round(c[1])}`;
    if (ann.type === "polygon" || ann.type === "polyline" || ann.type === "line") {
      sizeValue = `${ann.points.length} pts`;
    }
  }

  const symbolSize = parseSymbolSize(ann.meta);
  const calculatedSize = formatAnnotationCalculatedSize(ann, dpi, drawingScale);

  const rows = [
    { label: "Type", value: ann.type },
    coordValue ? { label: "Coords", value: coordValue } : null,
    sizeValue
      ? { label: ann.type === "bbox" || ann.type === "circle" ? "Size" : "Points", value: sizeValue }
      : null,
    ann.confidence !== undefined
      ? { label: "Confidence", value: `${Math.round(ann.confidence * 100)}%` }
      : null,
    symbolSize ? { label: "Symbol", value: formatSymbolSize(symbolSize) } : null,
    calculatedSize ? { label: "Measured", value: calculatedSize } : null,
  ].filter((r): r is { label: string; value: string } => r != null);

  const cardHeight = HEADER_HEIGHT + rows.length * LINE_HEIGHT + CARD_PADDING * 1.5;

  // The card is laid out in screen pixels but placed in image pixels, so the
  // clamp against the image edge converts its size at the rendered scale.
  let cardX = anchorX;
  let cardY = anchorY - (cardHeight + CARD_GAP) / scale;
  if (imageBounds) {
    const anchorInsideBounds =
      anchorX >= 0 &&
      anchorX <= imageBounds.width &&
      anchorY >= 0 &&
      anchorY <= imageBounds.height;
    if (anchorInsideBounds) {
      cardX = Math.max(EDGE_MARGIN / scale, Math.min(cardX, imageBounds.width - (CARD_WIDTH + EDGE_MARGIN) / scale));
      if (cardY < EDGE_MARGIN / scale) {
        cardY = anchorY + CARD_GAP / scale;
      }
    }
  }

  return (
    <ScreenSpace x={cardX} y={cardY} scale={scale} listening={false}>
      <Rect
        width={CARD_WIDTH}
        height={cardHeight}
        fill={hexToRgba(theme.bgElevated, 0.95)}
        stroke={hexToRgba(theme.border, 0.55)}
        strokeWidth={1}
        cornerRadius={10}
        listening={false}
      />
      <Text
        x={CARD_PADDING}
        y={CARD_PADDING / 2}
        text={displayName}
        fontSize={12}
        fontStyle="bold"
        fill={theme.textPrimary}
        fontFamily="system-ui"
        listening={false}
      />
      <Line
        points={[CARD_PADDING, HEADER_HEIGHT, CARD_WIDTH - CARD_PADDING, HEADER_HEIGHT]}
        stroke={hexToRgba(theme.border, 0.55)}
        strokeWidth={1}
        listening={false}
      />
      {rows.map((row, i) => (
        <Text
          key={i}
          x={CARD_PADDING}
          y={HEADER_HEIGHT + CARD_PADDING / 2 + i * LINE_HEIGHT}
          text={`${row.label}: ${row.value}`}
          fontSize={11}
          fill={theme.textSecondary}
          fontFamily="system-ui"
        />
      ))}
    </ScreenSpace>
  );
}
