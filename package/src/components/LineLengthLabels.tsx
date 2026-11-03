"use client";

import React from "react";
import { Group, Rect, Text } from "react-konva";
import type { ThemeVars } from "../theme";
import { formatLengthLabel, type DrawingScaleInput } from "../utils/dimensions";
import { quadLength, quadPoint, type Pt } from "../utils/curves";
import { hexToRgba } from "./canvasHelpers";
import { ScreenSpace } from "./ScreenSpace";

/** Screen-pixel metrics of a length label; monospace keeps the width predictable. */
const LABEL_FONT_SIZE = 11;
const LABEL_CHAR_WIDTH = 6.7;
const LABEL_PADDING_X = 5;
const LABEL_HEIGHT = 16;
/** Gap between the line and the label's near edge. */
const LABEL_GAP = 4;

interface LineLengthLabelsProps {
  /** Path vertices in image pixels. */
  points: readonly Pt[];
  /** Per-segment quadratic control point, or null for a straight segment. */
  curves?: readonly (Pt | null)[] | undefined;
  dpi: number | undefined;
  drawingScale: DrawingScaleInput | undefined;
  /** The stage scale React last rendered with. */
  scale: number;
  theme: ThemeVars;
}

/**
 * Each segment's real-world length, written along the segment at its middle.
 *
 * Purely visual: nothing listens, so it never takes a click from the shape or
 * the tool underneath. Renders nothing when the scale is not configured.
 */
export function LineLengthLabels({ points, curves, dpi, drawingScale, scale, theme }: LineLengthLabelsProps) {
  if (points.length < 2 || !formatLengthLabel(1, dpi, drawingScale)) return null;

  const labels: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const c = curves?.[i] ?? null;
    const length = c ? quadLength(a, c, b) : Math.hypot(b[0] - a[0], b[1] - a[1]);
    const text = formatLengthLabel(length, dpi, drawingScale);
    if (!text) continue;

    const width = text.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2;

    // A quadratic's tangent at t = 0.5 is parallel to its chord, so both kinds
    // of segment read along a - b.
    const mid = c ? quadPoint(a, c, b, 0.5) : ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt);
    let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    else if (angle < -90) angle += 180;

    labels.push(
      <ScreenSpace key={i} x={mid[0]} y={mid[1]} scale={scale} listening={false}>
        <Group rotation={angle} listening={false}>
          <Group x={-width / 2} y={-(LABEL_HEIGHT + LABEL_GAP)}>
            <Rect
              width={width}
              height={LABEL_HEIGHT}
              fill={hexToRgba(theme.bgElevated, 0.9)}
              stroke={hexToRgba(theme.border, 0.55)}
              strokeWidth={1}
              cornerRadius={4}
              perfectDrawEnabled={false}
            />
            <Text
              x={LABEL_PADDING_X}
              y={2.5}
              text={text}
              fontSize={LABEL_FONT_SIZE}
              fontFamily="'JetBrains Mono','Fira Code',ui-monospace,monospace"
              fill={theme.textPrimary}
              perfectDrawEnabled={false}
            />
          </Group>
        </Group>
      </ScreenSpace>,
    );
  }
  return labels.length ? <Group listening={false}>{labels}</Group> : null;
}
