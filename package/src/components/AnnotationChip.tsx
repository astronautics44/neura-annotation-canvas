
import React from "react";
import { Group, Rect, Text } from "react-konva";
import type { ThemeVars } from "../theme";
import { hexToRgba } from "./canvasHelpers";

interface AnnotationChipProps {
  x: number;
  y: number;
  scale: number;
  text: string;
  theme: ThemeVars;
}

export function AnnotationChip({ x, y, scale, text, theme }: AnnotationChipProps) {
  const chipWidth = Math.min(Math.max(text.length * 8 / scale + 16 / scale, 50 / scale), 240 / scale);
  const chipHeight = 18 / scale;

  return (
    <Group x={x} y={y} listening={false}>
      <Rect
        x={0}
        y={0}
        width={chipWidth}
        height={chipHeight}
        fill={hexToRgba(theme.bgElevated, 0.95)}
        stroke={hexToRgba(theme.border, 0.55)}
        strokeWidth={1 / scale}
        cornerRadius={8 / scale}
      />
      <Text
        x={8 / scale}
        y={1 / scale}
        text={text}
        fontSize={11 / scale}
        fill={theme.textPrimary}
        fontFamily="system-ui"
        listening={false}
      />
    </Group>
  );
}
