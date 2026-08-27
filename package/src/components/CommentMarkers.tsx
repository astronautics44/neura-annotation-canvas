"use client";

import React from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Line, Path, Text } from "react-konva";
import type { CanonicalAnnotation } from "../types/canonical";
import type { CommentAnchor } from "../types/comments";
import { getAnnotationBounds } from "./canvasHelpers";

/**
 * The comment cue layer.
 *
 * Both cues are the same speech-bubble glyph as the toolbar's comment tool, in a
 * loud red outline over an opaque fill — a construction drawing is dense grey
 * linework, and a cue that blends into it is not a cue. Position is what tells
 * the two apart: a free-form thread sits with its tail on the point it marks, an
 * attached one is centred on its shape's top-right corner.
 *
 * Everything is sized in screen pixels (divided by `scale`) so a marker is the
 * same size at 5% and at 2000% zoom. Markers are never hidden at low zoom the
 * way label chips are: the marker is the only signal that a thread exists, and
 * zoomed-out is exactly when you are hunting for one.
 */

/** Lucide `MessageCircle`, the same path the toolbar button draws. 24x24 box. */
const BUBBLE_PATH =
  "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z";

/** Rendered size of the glyph, in screen px. */
const SIZE = 24;
/** Path-space coordinates of the tail tip and of the bubble's optical centre. */
const TAIL = { x: 3, y: 21 };
const CENTER = { x: 12.2, y: 11 };
/** Path-space corner the delete affordance hangs off. */
const DELETE_AT = { x: 19.5, y: 4 };
const DELETE_R = 6.5;

interface MarkerGeom {
  anchor: CommentAnchor;
  /** Where the 24x24 path origin lands, in image coords. */
  x0: number;
  y0: number;
}

function countLabel(anchor: CommentAnchor): string | null {
  return anchor.count && anchor.count > 1 ? String(anchor.count) : null;
}

/**
 * Resolve every anchor to a position. Anchors targeting an annotation that is
 * gone — deleted, or hidden by the class filter — are dropped rather than
 * drawn at the origin.
 */
export function layoutMarkers(
  anchors: CommentAnchor[],
  visibleAnnotations: CanonicalAnnotation[],
  scale: number,
): MarkerGeom[] {
  const k = SIZE / 24 / scale;
  const byId = new Map(visibleAnnotations.map((a) => [a.id, a]));
  const out: MarkerGeom[] = [];

  for (const anchor of anchors) {
    if (anchor.target.kind === "point") {
      // The tail tip is the thing that marks the spot.
      const [x, y] = anchor.target.at;
      out.push({ anchor, x0: x - TAIL.x * k, y0: y - TAIL.y * k });
    } else {
      const ann = byId.get(anchor.target.annotationId);
      if (!ann) continue;
      const b = getAnnotationBounds(ann);
      out.push({ anchor, x0: b.x + b.w - CENTER.x * k, y0: b.y - CENTER.y * k });
    }
  }
  return out;
}

interface Props {
  anchors: CommentAnchor[];
  visibleAnnotations: CanonicalAnnotation[];
  scale: number;
  /** Outline colour for an open thread — loud by design. */
  accent: string;
  /** Outline colour for a resolved thread. */
  muted: string;
  selectedId: string | null;
  hoveredId: string | null;
  /** Draft position (image coords) for a thread the consumer has not stored yet. */
  draftAt: [number, number] | null;
  /** Whether to offer the hover delete affordance at all. */
  canDelete: boolean;
  onHover: (id: string | null) => void;
  /** `at` is the bubble centre in image coords, for anchoring a thread popover. */
  onSelect: (id: string, at: [number, number]) => void;
  onDelete: (id: string) => void;
}

export function CommentMarkers({
  anchors,
  visibleAnnotations,
  scale,
  accent,
  muted,
  selectedId,
  hoveredId,
  draftAt,
  canDelete,
  onHover,
  onSelect,
  onDelete,
}: Props) {
  const u = 1 / scale;
  const k = SIZE / 24 / scale;
  const markers = layoutMarkers(anchors, visibleAnnotations, scale);

  return (
    <>
      {markers.map(({ anchor, x0, y0 }) => {
        const label = countLabel(anchor);
        const isSelected = selectedId === anchor.id;
        const isHovered = hoveredId === anchor.id;
        const stroke = anchor.resolved ? muted : accent;
        const cx = x0 + CENTER.x * k;
        const cy = y0 + CENTER.y * k;

        return (
          <Group
            key={anchor.id}
            opacity={anchor.resolved && !isSelected ? 0.5 : 1}
            onMouseEnter={() => onHover(anchor.id)}
            onMouseLeave={() => onHover(null)}
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; }}
            onClick={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              onSelect(anchor.id, [cx, cy]);
            }}
          >
            <Path
              x={x0}
              y={y0}
              scaleX={k}
              scaleY={k}
              data={BUBBLE_PATH}
              // Opaque interior, so the outline never has to fight the linework
              // showing through it.
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={isSelected ? 3.4 : isHovered ? 2.9 : 2.4}
              lineJoin="round"
              lineCap="round"
              shadowColor="#000000"
              shadowBlur={isSelected ? 10 : 5}
              shadowOpacity={0.3}
            />
            {label && (
              <Text
                x={cx - 10 * u}
                y={cy - 6 * u}
                width={20 * u}
                height={12 * u}
                text={label}
                fontSize={10.5 * u}
                fontStyle="700"
                fontFamily="system-ui,-apple-system,'Segoe UI',sans-serif"
                fill={stroke}
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            )}

            {/* Delete affordance — only on hover, and only when wired up. */}
            {canDelete && isHovered && (() => {
              const dx = x0 + DELETE_AT.x * k;
              const dy = y0 + DELETE_AT.y * k;
              const arm = 2.5 * u;
              return (
                <Group
                  onMouseDown={(e: KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; }}
                  onClick={(e: KonvaEventObject<MouseEvent>) => {
                    e.cancelBubble = true;
                    onDelete(anchor.id);
                  }}
                >
                  <Circle
                    x={dx}
                    y={dy}
                    radius={DELETE_R * u}
                    fill="#1f2937"
                    stroke="#ffffff"
                    strokeWidth={1.2 * u}
                  />
                  <Line points={[dx - arm, dy - arm, dx + arm, dy + arm]} stroke="#ffffff" strokeWidth={1.5 * u} lineCap="round" listening={false} />
                  <Line points={[dx + arm, dy - arm, dx - arm, dy + arm]} stroke="#ffffff" strokeWidth={1.5 * u} lineCap="round" listening={false} />
                </Group>
              );
            })()}
          </Group>
        );
      })}

      {/* Draft marker: shown from the click until the consumer stores the thread. */}
      {draftAt && (
        <Path
          listening={false}
          opacity={0.8}
          x={draftAt[0] - TAIL.x * k}
          y={draftAt[1] - TAIL.y * k}
          scaleX={k}
          scaleY={k}
          data={BUBBLE_PATH}
          fill="#ffffff"
          stroke={accent}
          strokeWidth={2.4}
          dash={[3, 2.5]}
          lineJoin="round"
          lineCap="round"
        />
      )}
    </>
  );
}
