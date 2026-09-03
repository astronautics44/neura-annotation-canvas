
import React from "react";
import { Group, Rect, Text } from "react-konva";
import type { ThemeVars } from "../theme";
import { hexToRgba } from "./canvasHelpers";
import { ScreenSpace } from "./ScreenSpace";

const CHIP_HEIGHT = 18;
const CHIP_MIN_WIDTH = 50;
const CHIP_MAX_WIDTH = 240;
const CHIP_PADDING = 16;
const CHIP_CHAR_WIDTH = 8;

interface AnnotationChipProps {
  /** Anchor, in image pixels. */
  x: number;
  y: number;
  /** Offset from the anchor, in screen pixels. */
  dx: number;
  dy: number;
  scale: number;
  text: string;
  theme: ThemeVars;
}

export function AnnotationChip({ x, y, dx, dy, scale, text, theme }: AnnotationChipProps) {
  const chipWidth = Math.min(Math.max(text.length * CHIP_CHAR_WIDTH + CHIP_PADDING, CHIP_MIN_WIDTH), CHIP_MAX_WIDTH);

  return (
    <ScreenSpace x={x} y={y} scale={scale} listening={false}>
      <Group x={dx} y={dy}>
        <Rect
          x={0}
          y={0}
          width={chipWidth}
          height={CHIP_HEIGHT}
          fill={hexToRgba(theme.bgElevated, 0.95)}
          stroke={hexToRgba(theme.border, 0.55)}
          strokeWidth={1}
          cornerRadius={8}
        />
        <Text
          x={8}
          y={1}
          text={text}
          fontSize={11}
          fill={theme.textPrimary}
          fontFamily="system-ui"
          listening={false}
        />
      </Group>
    </ScreenSpace>
  );
}
