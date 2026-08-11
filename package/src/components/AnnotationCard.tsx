
import React from "react";
import { Group, Rect, Text, Line } from "react-konva";
import type { CanonicalAnnotation } from "../types/canonical";
import type { ThemeVars } from "../theme";
import type { DrawingScale } from "../utils/drawingScale";
import { hexToRgba, bboxToKonva, centroid } from "./canvasHelpers";
import { formatSymbolSize, parseSymbolSize } from "../utils/symbolSize";
import { formatAnnotationCalculatedSize } from "../utils/dimensions";

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
  const cardWidth = 180 / scale;
  const padding = 10 / scale;
  const headerHeight = 22 / scale;
  const lineHeight = 16 / scale;

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

  const cardHeight = headerHeight + rows.length * lineHeight + padding * 1.5;

  let cardX = anchorX;
  let cardY = anchorY - cardHeight - 8 / scale;
  if (imageBounds) {
    const anchorInsideBounds =
      anchorX >= 0 &&
      anchorX <= imageBounds.width &&
      anchorY >= 0 &&
      anchorY <= imageBounds.height;
    if (anchorInsideBounds) {
      cardX = Math.max(4 / scale, Math.min(cardX, imageBounds.width - cardWidth - 4 / scale));
      if (cardY < 4 / scale) {
        cardY = anchorY + 8 / scale;
      }
    }
  }

  return (
    <Group x={cardX} y={cardY} listening={false}>
      <Rect
        width={cardWidth}
        height={cardHeight}
        fill={hexToRgba(theme.bgElevated, 0.95)}
        stroke={hexToRgba(theme.border, 0.55)}
        strokeWidth={1 / scale}
        cornerRadius={10 / scale}
        listening={false}
      />
      <Text
        x={padding}
        y={padding / 2}
        text={displayName}
        fontSize={12 / scale}
        fontStyle="bold"
        fill={theme.textPrimary}
        fontFamily="system-ui"
        listening={false}
      />
      <Line
        points={[padding, headerHeight, cardWidth - padding, headerHeight]}
        stroke={hexToRgba(theme.border, 0.55)}
        strokeWidth={1 / scale}
        listening={false}
      />
      {rows.map((row, i) => (
        <Text
          key={i}
          x={padding}
          y={headerHeight + padding / 2 + i * lineHeight}
          text={`${row.label}: ${row.value}`}
          fontSize={11 / scale}
          fill={theme.textSecondary}
          fontFamily="system-ui"
        />
      ))}
    </Group>
  );
}
