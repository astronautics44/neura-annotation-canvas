# @neura/annotation-engine

A professional-grade React annotation component for reviewing and correcting CV engine output on construction drawings. Built for the same use-case class as CVAT and Roboflow — canvas-first, keyboard-driven, designed for engineers doing quantity takeoffs.

---

## What it does

A CV engine processes a drawing and outputs bounding boxes, polygons, or points. Before any measurement or cost takeoff can happen, a human reviewer needs to:

- Confirm correct detections
- Move or resize wrong ones
- Add missed objects
- Delete false positives
- Relabel misclassified objects

`AnnotationCanvas` is the tool for that review step. It speaks one data format — the canonical schema — and it is the client webapp's job to translate from whatever the CV engine outputs into that format.

---

## Monorepo layout

```
annotation-engine/
├── package/          ← the publishable library (@neura/annotation-engine)
│   └── src/
│       ├── index.ts                   public exports only
│       ├── types/canonical.ts         locked canonical types
│       ├── components/
│       │   ├── AnnotationCanvas.tsx   main component
│       │   ├── Toolbar.tsx
│       │   ├── LabelPanel.tsx
│       │   └── LabelPopover.tsx
│       ├── utils/geometry.ts          geo export (coord math helpers)
│       └── theme.ts                   ThemeVars + defaults
│
└── harness/          ← Next.js dev app, not shipped
    ├── app/page.tsx                   fixture selector + full-screen demo
    ├── fixtures/                      4 mock engine outputs + label registry
    └── lib/adapters.ts                REFERENCE adapter implementations
```

---

## Running the harness

```bash
npm install
npm run dev         # starts harness at http://localhost:3000
npm run build:pkg   # builds the package only
```

---

## Installation in a client webapp

The package is not yet published to npm. Add it as a workspace dependency or path alias.

```bash
# As a local path dep in your package.json:
"@neura/annotation-engine": "file:../annotation-engine/package"
```

Required peer deps:

```bash
npm install react react-dom
```

The package bundles Konva, react-konva, and use-image — you do not install those separately.

---

## Quick start

```tsx
// app/review/page.tsx
import dynamic from "next/dynamic";
import type { LabelMap } from "@neura/annotation-engine";
import { adaptEngineOutput } from "@/lib/annotation.adapter";  // YOUR adapter
import { labelRegistry } from "@/lib/annotation.labels";       // YOUR label config

// Always load via dynamic — Konva touches `window` at import time
const AnnotationCanvas = dynamic(
  () => import("@neura/annotation-engine").then((m) => m.AnnotationCanvas),
  { ssr: false },
);

const canonical = adaptEngineOutput(engineApiResponse);

export default function ReviewPage() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <AnnotationCanvas
        image={drawingUrl}
        labels={labelRegistry}
        annotations={canonical}
        onSave={(annotations) => saveCorrections(annotations)}
      />
    </div>
  );
}
```

---

## Component API

```typescript
interface AnnotationCanvasProps {
  // Required
  image: string;                                   // URL or base64 data URL
  labels: LabelMap[];                              // full label registry for this client

  // Data
  annotations?: CanonicalAnnotation[];             // pre-adapted engine output, loaded on mount
  onSave: (annotations: CanonicalAnnotation[]) => void;
  onChange?: (annotations: CanonicalAnnotation[]) => void;  // fires on every mutation
  onLabelsChange?: (labels: LabelMap[]) => void;            // fires when user creates a new label

  // Tools
  tools?: ToolType[];   // subset to expose; default: all ["select","bbox","polygon","line","point"]

  // Behavior
  readonly?: boolean;   // disables all editing; view mode only

  // Layout
  className?: string;   // applied to the outer container div

  // Theming
  theme?: Partial<ThemeVars>;  // override any design token; see Theming section
}
```

### Layout model

The component fills 100% of its container. You control size by controlling the container:

```tsx
// Full viewport
<div style={{ width: "100vw", height: "100vh" }}>
  <AnnotationCanvas ... />
</div>

// Fixed panel
<div style={{ width: 960, height: 600 }}>
  <AnnotationCanvas ... />
</div>

// Inside a CSS grid layout — fills its cell automatically
<main style={{ display: "grid", gridTemplate: "auto 1fr / 1fr", height: "100vh" }}>
  <header>...</header>
  <AnnotationCanvas ... />
</main>
```

---

## Canonical types

These are the locked contract. **Do not change them inside the package.**

```typescript
// package/src/types/canonical.ts

export type ToolType = "select" | "bbox" | "polygon" | "line" | "point";

export type AnnotationType = "bbox" | "polygon" | "line" | "point";

export interface CanonicalAnnotation {
  id: string;                    // nanoid, generated on creation
  type: AnnotationType;
  points: [number, number][];    // always image pixel coords:
                                 //   bbox:    [[x1,y1],[x2,y2]]
                                 //   polygon: [[x,y],[x,y],...] (open — no duplicate last point)
                                 //   line:    [[x1,y1],[x2,y2]]
                                 //   point:   [[x,y]]
  label: string;                 // canonicalClassId, e.g. "door"
  confidence?: number;           // 0–1. undefined = human-created annotation
  source: "engine" | "human";   // engine = from CV output; human = added/modified by reviewer
  meta?: Record<string, unknown>;// passthrough, not used by the package
}

export interface LabelMap {
  canonicalClassId: string;      // internal ID used everywhere, e.g. "door"
  displayName: string;           // shown in UI, e.g. "Door"
  color: string;                 // hex, e.g. "#FF6B6B"
  defaultTool?: AnnotationType;  // auto-selects this tool when label is picked
}
```

---

## Adapters — the most important concept

**The package has zero knowledge of any CV engine's output format.**

Every CV engine outputs different JSON. Before you can pass data to `AnnotationCanvas`, your webapp must translate it into `CanonicalAnnotation[]`. That translation is called an **adapter** and it lives **entirely in your webapp**, never in this package.

The package only exports `geo` — pure coordinate math functions that know nothing about field names or schemas. Everything else (field mapping, label resolution, confidence normalization) is your code.

### Writing an adapter

```typescript
// client-webapp/lib/annotation.adapter.ts

import { geo } from "@neura/annotation-engine";
import type { CanonicalAnnotation } from "@neura/annotation-engine";

// Step 1: type your engine's output exactly as it arrives
type EngineApiResponse = {
  detections: Array<{
    class: string;
    cx: number; cy: number; w: number; h: number;
    confidence: number;
  }>;
  image_width: number;
  image_height: number;
};

// Step 2: define your engine→canonical label map
const CLASS_MAP: Record<string, string> = {
  door_opening: "door",
  window_frame: "window",
  room_boundary: "room",
};

// Step 3: write the adapter — one-way, pure function
export function adaptEngineOutput(raw: EngineApiResponse): CanonicalAnnotation[] {
  return raw.detections.map((d) => ({
    id: crypto.randomUUID(),
    type: "bbox",
    points: geo.yoloBoxToPoints(
      [d.cx, d.cy, d.w, d.h],
      raw.image_width,
      raw.image_height,
    ),
    label: CLASS_MAP[d.class] ?? "unknown",
    confidence: d.confidence,
    source: "engine",
  }));
}
```

The adapter runs **in your webapp** before passing data to `AnnotationCanvas`. The component never sees raw engine output.

### Reference adapter implementations

`harness/lib/adapters.ts` contains four fully-worked adapter examples covering the most common engine formats:

| Adapter | Engine format | Key technique |
|---|---|---|
| `adaptEngineA` | COCO (`bbox` + `segmentation`) | `geo.cocoBoxToPoints`, `geo.cocoSegToPoints` |
| `adaptEngineB` | YOLO normalized `[cx,cy,w,h]` | `geo.yoloBoxToPoints` |
| `adaptEngineC` | Arbitrary custom JSON | direct coord pass-through |
| `adaptEngineD` | Quad bbox (4 corner points) | `geo.quadToPoints`, `source:"Human"` mapping |

Copy and adapt those patterns — don't import from `harness/`.

---

## `geo` — coordinate math utilities

Exported from the package for use in your adapters. All functions are pure, schema-free math.

```typescript
import { geo } from "@neura/annotation-engine";

// 4-point quad bbox (clockwise from top-left) → [[x1,y1],[x2,y2]]
geo.quadToPoints(quad: [number, number][]): [[number, number], [number, number]]

// COCO [x, y, w, h] → [[x1,y1],[x2,y2]]
geo.cocoBoxToPoints(box: [number, number, number, number]): [[number, number], [number, number]]

// YOLO normalized [cx, cy, w, h] → [[x1,y1],[x2,y2]] in pixel coords
geo.yoloBoxToPoints(
  box: [number, number, number, number],
  imgW: number,
  imgH: number
): [[number, number], [number, number]]

// COCO flat segmentation [x1,y1,x2,y2,...] → [[x,y],[x,y],...]
geo.cocoSegToPoints(seg: number[]): [number, number][]
```

---

## Theming

The component ships with a dark professional theme and exposes every design token as an overridable variable via the `theme` prop.

### ThemeVars reference

```typescript
import type { ThemeVars } from "@neura/annotation-engine";
import { DEFAULT_THEME } from "@neura/annotation-engine";

interface ThemeVars {
  // Backgrounds
  bgBase:        string;  // outermost container        default: #141414
  bgSurface:     string;  // toolbar, panels, status bar default: #1e1e1e
  bgElevated:    string;  // hover states, dropdowns     default: #2a2a2a
  bgCanvas:      string;  // the Konva stage background  default: #0f0f0f

  // Borders
  border:        string;  // panel borders, dividers     default: #333333
  borderSubtle:  string;  // subtle separators           default: #2a2a2a

  // Text
  textPrimary:   string;  // main content text           default: #e8e8e8
  textSecondary: string;  // labels, hints               default: #8a8a8a
  textMuted:     string;  // disabled, placeholders      default: #555555

  // Brand / interaction
  accent:        string;  // active tool, focus rings, in-progress drawing  default: #2563eb
  accentHover:   string;  // accent on hover             default: #1d4ed8
  danger:        string;  // delete buttons              default: #ef4444
  success:       string;  // polygon close indicator     default: #22c55e
  handleFill:    string;  // resize/vertex handle fill   default: #ffffff
  selection:     string;  // selected row overlay (rgba) default: rgba(37,99,235,0.15)

  // Layout dimensions (px)
  toolbarWidth:     number;  // left toolbar width    default: 48
  panelWidth:       number;  // right label panel     default: 220
  statusBarHeight:  number;  // bottom status bar     default: 28
}
```

### Applying a custom theme

Pass any subset of `ThemeVars` — unset keys fall back to defaults:

```tsx
import type { ThemeVars } from "@neura/annotation-engine";

const myTheme: Partial<ThemeVars> = {
  bgBase:    "#0C0C0C",
  bgSurface: "#161616",
  bgCanvas:  "#080808",
  accent:    "#F97316",       // orange brand color
  accentHover: "#EA6C0A",
  selection: "rgba(249,115,22,0.15)",
};

<AnnotationCanvas theme={myTheme} ... />
```

### CSS variable override (alternative)

The theme values are injected as CSS custom properties on the root element (`--ae-*`). You can also override them from a parent stylesheet without touching the `theme` prop:

```css
.my-annotation-container {
  --ae-accent:        #7c3aed;
  --ae-bg-base:       #ffffff;
  --ae-text-primary:  #111827;
  /* etc. */
}
```

```tsx
<div className="my-annotation-container">
  <AnnotationCanvas ... />
</div>
```

### All CSS variable names

| Token | CSS variable |
|---|---|
| `bgBase` | `--ae-bg-base` |
| `bgSurface` | `--ae-bg-surface` |
| `bgElevated` | `--ae-bg-elevated` |
| `bgCanvas` | `--ae-bg-canvas` |
| `border` | `--ae-border` |
| `borderSubtle` | `--ae-border-subtle` |
| `textPrimary` | `--ae-text-primary` |
| `textSecondary` | `--ae-text-secondary` |
| `textMuted` | `--ae-text-muted` |
| `accent` | `--ae-accent` |
| `accentHover` | `--ae-accent-hover` |
| `danger` | `--ae-danger` |
| `success` | `--ae-success` |
| `handleFill` | `--ae-handle-fill` |
| `selection` | `--ae-selection` |

---

## Tool reference

### Toolbar layout

```
┌────────────────────────────────────────────────────┐
│  Toolbar (left, 48px)    Canvas    Label Panel (220px) │
│  ┌────┬────────────────────────────────┬──────────┐ │
│  │ V  │                                │          │ │
│  │ B  │     Konva canvas stage         │  Annot.  │ │
│  │ P  │     (fills remaining space)    │  list    │ │
│  │ L  │                                │          │ │
│  │ N  │                                │          │ │
│  │────│                                │          │ │
│  │ H  │                                │          │ │
│  └────┴────────────────────────────────┴──────────┘ │
│  Status bar (bottom, 28px) — Zoom % | cursor x y    │
└────────────────────────────────────────────────────┘
```

### Tools and keyboard shortcuts

| Tool | Key | Icon | Behavior |
|---|---|---|---|
| Select | `V` or `Esc` | cursor | Click to select, drag to move, `Delete`/`Backspace` to remove |
| BBox | `B` | square | Click-drag to draw rectangle; label popover on release |
| Polygon | `P` | pentagon | Click to place vertices; close by clicking first vertex or pressing `Enter` |
| Line | `L` | minus | Two-click draw; label popover on second click |
| Point | `N` | crosshair | Single click; label popover immediately |
| Hand (pan) | `H` | hand | Toggle pan mode; also `Space`+drag or middle-mouse drag |

### Canvas navigation

| Action | Input |
|---|---|
| Zoom in/out | Scroll wheel (centered on cursor) |
| Pan | `Space` + drag, or middle-mouse drag, or `H` tool |
| Fit to screen | `Cmd/Ctrl` + `0` |
| Zoom in | `Cmd/Ctrl` + `=` |
| Zoom out | `Cmd/Ctrl` + `-` |
| Save | `Cmd/Ctrl` + `S` |
| Undo | `Cmd/Ctrl` + `Z` |
| Redo | `Cmd/Ctrl` + `Shift` + `Z` or `Ctrl` + `Y` |
| Cancel draw | `Escape` |
| Delete selected | `Delete` or `Backspace` |

Zoom range: 5% – 2000%. The status bar shows the current zoom and cursor position in image pixel coordinates.

### Label selector popover

Appears after completing a draw gesture. Supports:
- Typing to search/filter labels
- Arrow keys to navigate
- `Enter` to select, `Escape` to cancel (discards the annotation)
- If only one label exists, it is auto-selected — no popover shown
- If the typed name doesn't match any label, a **Create "..."** row appears (disabled in `readonly` mode)

---

## Label panel (right sidebar)

Shows all annotations grouped by label. Features:

- Click an annotation row to select it on canvas (auto-pans if out of view)
- Click a group header to collapse/expand
- Hover a row to reveal relabel (✎) and delete (✕) actions
- Each annotation shows an `H` badge (human-created) or `AI` badge (engine output)

---

## State management

All state lives inside `AnnotationCanvas`. No external store required.

- `onSave` fires only when the user explicitly saves (`Ctrl+S` or a Save button you add externally)
- `onChange` fires after every mutation (add, update, delete, move)
- `onLabelsChange` fires when the user creates a new label via the popover

Undo/redo history is kept in-memory (up to 100 steps). It resets when `annotations` prop changes.

---

## Annotation rendering

Annotations render differently based on state and source:

| State | Stroke width | Fill alpha | Opacity |
|---|---|---|---|
| Engine (default) | 1.5px | 8% | 85% |
| Human (default) | 2px | 12% | 100% |
| Hovered | 2.5px | 15% | — |
| Selected | 2px | 18% | — |

Selected annotations show resize handles (bboxes: 8 handles at corners + edge midpoints; polygons: handles at every vertex; lines: handles at endpoints).

Label chips (color dot + display name + confidence %) are rendered at each annotation. They are hidden when zoom drops below 30%.

---

## SSR / Next.js requirements

Konva touches `window` at import time. **Always load `AnnotationCanvas` with `dynamic` and `ssr: false`.**

```tsx
// Correct — the only way to use this in Next.js
const AnnotationCanvas = dynamic(
  () => import("@neura/annotation-engine").then((m) => m.AnnotationCanvas),
  { ssr: false },
);
```

The package does not do this itself — SSR gating is the consumer's responsibility.

---

## What the package exports

```typescript
// package/src/index.ts

export { AnnotationCanvas }      // the main component
export type { CanonicalAnnotation, LabelMap, ToolType }  // canonical types
export type { ThemeVars }        // theme token interface
export { DEFAULT_THEME }         // the default dark palette, useful as a base
export { geo }                   // coordinate math helpers for use in adapters
```

**Nothing else is exported.** Internal components (`Toolbar`, `LabelPanel`, etc.), the reducer, and utility functions are private to the package.

---

## Hard rules

These are constraints, not suggestions.

1. **Never import from `@neura/annotation-engine` inside an adapter.** Your adapter imports `geo` and types, that's it. Schema field names (`matched_code`, `category_id`, etc.) never appear inside the package — only in your webapp.

2. **Always use `dynamic` + `ssr: false`** when importing `AnnotationCanvas` in Next.js. Skipping this breaks server rendering.

3. **All `points` values are image pixel coordinates.** Convert on the way in (engine coords → image px) and the package handles screen↔image transforms internally.

4. **`meta` is a passthrough.** The package stores it and returns it in `onSave`, but never reads or interprets it. Use it to carry any engine-specific fields you need downstream.

5. **Do not modify `canonical.ts`.** It is the shared contract between the package and all client webapps. Changes there break every existing adapter.

---

## Label registry example

```typescript
// client-webapp/lib/annotation.labels.ts
import type { LabelMap } from "@neura/annotation-engine";

export const labelRegistry: LabelMap[] = [
  { canonicalClassId: "door",    displayName: "Door",    color: "#FF6B6B", defaultTool: "bbox" },
  { canonicalClassId: "window",  displayName: "Window",  color: "#4ECDC4", defaultTool: "bbox" },
  { canonicalClassId: "wall",    displayName: "Wall",    color: "#FFE66D", defaultTool: "polygon" },
  { canonicalClassId: "room",    displayName: "Room",    color: "#A8E6CF", defaultTool: "polygon" },
  { canonicalClassId: "column",  displayName: "Column",  color: "#B8B8FF", defaultTool: "point" },
  { canonicalClassId: "stair",   displayName: "Stair",   color: "#FF9A9E", defaultTool: "polygon" },
];
```

---

## Full integration example

```tsx
// client-webapp/app/review/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { CanonicalAnnotation, LabelMap, ThemeVars } from "@neura/annotation-engine";
import { adaptEngineOutput } from "@/lib/annotation.adapter";
import { labelRegistry as initialRegistry } from "@/lib/annotation.labels";

const AnnotationCanvas = dynamic(
  () => import("@neura/annotation-engine").then((m) => m.AnnotationCanvas),
  { ssr: false },
);

const theme: Partial<ThemeVars> = {
  accent: "#F97316",
  accentHover: "#EA6C0A",
  selection: "rgba(249,115,22,0.15)",
};

export default function ReviewPage({ engineOutput, imageUrl }) {
  const [labels, setLabels] = useState<LabelMap[]>(initialRegistry);
  const canonical = adaptEngineOutput(engineOutput);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <AnnotationCanvas
        image={imageUrl}
        labels={labels}
        annotations={canonical}
        theme={theme}
        onSave={(annotations: CanonicalAnnotation[]) => {
          // send corrected annotations back to your backend
          fetch("/api/annotations", {
            method: "POST",
            body: JSON.stringify(annotations),
          });
        }}
        onChange={(annotations) => {
          // optional: auto-save, update parent state, etc.
        }}
        onLabelsChange={(updated) => {
          // sync newly created labels to your label registry
          setLabels(updated);
        }}
      />
    </div>
  );
}
```
