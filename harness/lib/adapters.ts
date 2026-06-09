/**
 * REFERENCE ONLY — not exported by @neura/annotation-engine
 *
 * This file shows how a CLIENT WEBAPP should write its own adapter.
 * Copy the pattern, adapt the field names to your engine's schema.
 * The package (`@neura/annotation-engine`) has no adapters.
 * Adapters live exclusively in the consuming webapp.
 */

import { geo } from "@neura/annotation-engine";
import type { CanonicalAnnotation } from "@neura/annotation-engine";

// ---------------------------------------------------------------------------
// Engine A — COCO format
// category_id → canonical label via a local map you define per-client
// ---------------------------------------------------------------------------

type EngineACategory = { id: number; name: string };
type EngineAAnnotation = {
  id: number;
  category_id: number;
  bbox?: [number, number, number, number];
  segmentation?: number[][];
  score: number;
};
type EngineAOutput = {
  images: { id: number; width: number; height: number }[];
  annotations: EngineAAnnotation[];
  categories: EngineACategory[];
};

const COCO_CATEGORY_TO_CANONICAL: Record<string, string> = {
  ROOM_AREA: "room",
  WALL_SEGMENT: "wall",
  DR_OPENING: "door",
};

export function adaptEngineA(raw: EngineAOutput): CanonicalAnnotation[] {
  const catById = Object.fromEntries(raw.categories.map((c) => [c.id, c.name]));

  return raw.annotations.flatMap((a): CanonicalAnnotation[] => {
    const engineName = catById[a.category_id] ?? "";
    const label = COCO_CATEGORY_TO_CANONICAL[engineName] ?? "door";

    if (a.bbox) {
      return [{
        id: crypto.randomUUID(),
        type: "bbox",
        points: geo.cocoBoxToPoints(a.bbox),
        label,
        confidence: a.score,
        source: "engine",
      }];
    }

    if (a.segmentation?.[0]) {
      return [{
        id: crypto.randomUUID(),
        type: "polygon",
        points: geo.cocoSegToPoints(a.segmentation[0]),
        label,
        confidence: a.score,
        source: "engine",
      }];
    }

    return [];
  });
}

// ---------------------------------------------------------------------------
// Engine B — YOLO format (normalized coords)
// ---------------------------------------------------------------------------

type EngineBDetection = {
  class: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  confidence: number;
};
type EngineBOutput = {
  image_width: number;
  image_height: number;
  detections: EngineBDetection[];
};

const YOLO_CLASS_TO_CANONICAL: Record<string, string> = {
  door_opening: "door",
  room: "room",
};

export function adaptEngineB(raw: EngineBOutput): CanonicalAnnotation[] {
  return raw.detections.map((d) => ({
    id: crypto.randomUUID(),
    type: "bbox",
    points: geo.yoloBoxToPoints(
      [d.cx, d.cy, d.w, d.h],
      raw.image_width,
      raw.image_height,
    ),
    label: YOLO_CLASS_TO_CANONICAL[d.class] ?? "door",
    confidence: d.confidence,
    source: "engine" as const,
  }));
}

// ---------------------------------------------------------------------------
// Engine C — arbitrary custom format
// ---------------------------------------------------------------------------

type EngineCResult =
  | { type: "bbox"; label_id: number; x1: number; y1: number; x2: number; y2: number; conf: number }
  | { type: "poly"; label_id: number; vertices: [number, number][]; conf: number };

type EngineCOutput = {
  results: EngineCResult[];
  label_schema: Record<string, string>;
};

const ENGINEC_LABEL_TO_CANONICAL: Record<string, string> = {
  DOOR: "door",
  WALL: "wall",
};

export function adaptEngineC(raw: EngineCOutput): CanonicalAnnotation[] {
  return raw.results.map((r) => {
    const engineLabel = raw.label_schema[String(r.label_id)] ?? "";
    const label = ENGINEC_LABEL_TO_CANONICAL[engineLabel] ?? "door";

    if (r.type === "bbox") {
      return {
        id: crypto.randomUUID(),
        type: "bbox" as const,
        points: [[r.x1, r.y1], [r.x2, r.y2]] as [[number,number],[number,number]],
        label,
        confidence: r.conf,
        source: "engine" as const,
      };
    } else {
      return {
        id: crypto.randomUUID(),
        type: "polygon" as const,
        points: r.vertices,
        label,
        confidence: r.conf,
        source: "engine" as const,
      };
    }
  });
}

// ---------------------------------------------------------------------------
// Engine D — quad bbox (4 corner points), real production format
// source:"Human" → source:"human", confidence:undefined
// ---------------------------------------------------------------------------

type EngineDCode = {
  text: string;
  matched_code: string;
  bbox: [number, number][];
  confidence: number;
  source: string;
};
type EngineDOutput = {
  annotations: { schedule_codes: EngineDCode[] };
};

export function adaptEngineD(raw: EngineDOutput): CanonicalAnnotation[] {
  return raw.annotations.schedule_codes.map((item) => {
    const isHuman = item.source === "Human";
    return {
      id: crypto.randomUUID(),
      type: "bbox" as const,
      points: geo.quadToPoints(item.bbox),
      label: "door",
      confidence: isHuman ? undefined : item.confidence,
      source: isHuman ? "human" : ("engine" as const),
      meta: { text: item.text, matched_code: item.matched_code },
    };
  });
}
