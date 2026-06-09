# Annotation Engine — CLAUDE.md

## What We Are Building

A reusable React annotation module that can be dropped into any Next.js app.
It is a professional-grade annotation tool in the same class as CVAT and Roboflow —
not a lightweight drawing widget. Use those tools as the direct reference for
interaction model, tool behavior, and UI design.

The module solves one problem: after a CV engine processes a construction drawing
and outputs detected objects (bboxes, polygons, segmentation masks), a human needs
to review the output, correct mistakes, add missed objects, and delete false positives
before a quantity/cost takeoff is performed.

This is a multi-client product. Every client's CV engine outputs annotations in a
different format with different class naming conventions. The variance across engines
is too high to handle inside the package — engine schemas change, new clients onboard
with entirely new formats, and the package cannot have opinions about any of them.

The package knows nothing about any CV engine. It speaks one language: the canonical
schema. Adaptation from engine output to canonical is entirely the client webapp's
responsibility. The package provides geometry utility functions to help with coordinate
math, but the schema mapping — which engine field maps to which canonical field — lives
only in the client webapp, never in this package.

---

## Monorepo Structure

```
annotation-engine/
├── package.json                    # npm workspaces root
├── CLAUDE.md                       # this file
│
├── package/                        # the publishable library
│   ├── src/
│   │   ├── index.ts                # public exports only
│   │   ├── types/
│   │   │   └── canonical.ts        # CanonicalAnnotation, LabelMap, ToolType
│   │   ├── components/
│   │   │   ├── AnnotationCanvas.tsx  # main exported component
│   │   │   ├── Toolbar.tsx           # left sidebar tool palette
│   │   │   ├── LabelPanel.tsx        # right sidebar annotation list
│   │   │   └── LabelChip.tsx         # inline label on annotation
│   │   ├── tools/
│   │   │   ├── BBoxTool.ts
│   │   │   ├── PolygonTool.ts
│   │   │   ├── LineTool.ts
│   │   │   ├── PointTool.ts
│   │   │   └── SelectTool.ts
│   │   └── utils/
│   │       ├── geometry.ts           # coord math helpers — EXPORTED (no schema knowledge)
│   │       └── ids.ts                # nanoid wrapper — internal only
│   ├── package.json                # name: @neura/annotation-engine
│   └── tsconfig.json
│
└── harness/                        # Next.js dev app, not shipped
    ├── app/
    │   └── page.tsx                # full-screen annotation demo
    ├── fixtures/
    │   ├── engine-a.json           # COCO format mock output
    │   ├── engine-b.json           # YOLO format mock output
    │   ├── engine-c.json           # arbitrary custom JSON mock
    │   ├── engine-d.json           # quad bbox format (4-point corners)
    │   └── label-registry.ts       # canonical label config
    ├── lib/
    │   └── adapters.ts             # REFERENCE ONLY — not library code, not exported
    │                               # shows client webapps how to write their own adapters
    ├── package.json
    └── next.config.js
```

### Root package.json

```json
{
  "private": true,
  "workspaces": ["package", "harness"],
  "scripts": {
    "dev": "npm run dev --workspace=harness",
    "build:pkg": "npm run build --workspace=package"
  }
}
```

### package/package.json

```json
{
  "name": "@neura/annotation-engine",
  "version": "0.1.0",
  "private": false,
  "main": "src/index.ts",
  "dependencies": {
    "konva": "^9.x",
    "react-konva": "^18.x",
    "nanoid": "^5.x"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  }
}
```

### harness/package.json

```json
{
  "name": "annotation-harness",
  "private": true,
  "dependencies": {
    "@neura/annotation-engine": "*",
    "next": "^15.x",
    "react": "^18.x",
    "react-dom": "^18.x"
  }
}
```

---

## Canonical Types — DO NOT CHANGE THESE

These are the locked contract. All tools, all components, all utilities work with
these types and nothing else.

```typescript
// package/src/types/canonical.ts

export type ToolType = "select" | "bbox" | "polygon" | "line" | "point";

export type AnnotationType = "bbox" | "polygon" | "line" | "point";

export interface CanonicalAnnotation {
  id: string; // nanoid, generated on creation
  type: AnnotationType;
  points: [number, number][]; // ALWAYS pixel coords, ALWAYS this format:
  //   bbox:    [[x1,y1],[x2,y2]]
  //   polygon: [[x,y],[x,y],...]  open (no duplicate last point)
  //   line:    [[x1,y1],[x2,y2]]
  //   point:   [[x,y]]
  label: string; // canonicalClassId, e.g. "door"
  confidence?: number; // 0–1. undefined means human-created annotation.
  source: "engine" | "human"; // engine = came from CV, human = added/modified by user
  meta?: Record<string, unknown>; // passthrough, not used by the module
}

export interface LabelMap {
  canonicalClassId: string; // internal ID, e.g. "door"
  displayName: string; // shown in UI, e.g. "Door"
  color: string; // hex, e.g. "#FF6B6B"
  defaultTool?: AnnotationType; // which tool to auto-select when this label is active
}
```

---

## Component API — DO NOT CHANGE THIS

This is the full public surface of the library. Nothing else is exported.

```typescript
// package/src/index.ts
export { AnnotationCanvas } from "./components/AnnotationCanvas";
export type {
  CanonicalAnnotation,
  LabelMap,
  ToolType,
} from "./types/canonical";
export { geo } from "./utils/geometry"; // coord math only — no schema knowledge
```

```typescript
interface AnnotationCanvasProps {
  // --- required ---
  image: string; // URL or base64 data URL
  labels: LabelMap[]; // full label registry for this client

  // --- data ---
  annotations?: CanonicalAnnotation[]; // pre-adapted engine output, loaded on mount
  onSave: (annotations: CanonicalAnnotation[]) => void;
  onChange?: (annotations: CanonicalAnnotation[]) => void; // fires on every mutation

  // --- tools ---
  tools?: ToolType[]; // subset of tools to show; default: all

  // --- behavior ---
  readonly?: boolean; // disables all editing, view mode only

  // --- layout ---
  className?: string; // applied to the outer container div
}
```

Usage in a client webapp looks exactly like this and nothing more:

```tsx
// client-webapp/lib/annotation.adapter.ts  — lives HERE, not in the package
import { geo } from "@neura/annotation-engine";
import type { CanonicalAnnotation } from "@neura/annotation-engine";

export function adaptEngineOutput(
  raw: EngineApiResponse,
): CanonicalAnnotation[] {
  return raw.annotations.map((a) => ({
    id: crypto.randomUUID(),
    type: "bbox",
    points: geo.quadToPoints(a.bbox), // use geo utils for coord math
    label: mapEngineClassToCanonical(a.matched_code),
    confidence: a.source === "Human" ? undefined : a.confidence,
    source: a.source === "Human" ? "human" : "engine",
    meta: { text: a.text },
  }));
}
```

```tsx
// client-webapp/app/review/page.tsx
import dynamic from "next/dynamic";
import type { LabelMap } from "@neura/annotation-engine";
import { adaptEngineOutput } from "@/lib/annotation.adapter";
import { labelRegistry } from "@/lib/annotation.labels";

const AnnotationCanvas = dynamic(
  () => import("@neura/annotation-engine").then((m) => m.AnnotationCanvas),
  { ssr: false },
);

// adaptEngineOutput is called by the webapp before passing data in
// AnnotationCanvas never sees raw engine output — ever
const canonical = adaptEngineOutput(engineApiResponse);

<AnnotationCanvas
  image={engineOutputUrl}
  labels={labelRegistry}
  annotations={canonical}
  onSave={(annotations) => saveCorrections(annotations)}
/>;
```

---

## Adapter Contract — Read This Before Writing Any Code

**The package has zero knowledge of any CV engine's output format. This is non-negotiable.**

The only thing the package exports that touches data transformation is `geo` — a set of
pure coordinate math functions. These know nothing about any engine's schema. They just
do math on numbers.

```typescript
// package/src/utils/geometry.ts — everything in here is schema-free math

export const geo = {
  // 4-point quad bbox (clockwise from top-left) → [[x1,y1],[x2,y2]]
  quadToPoints(quad: [number, number][]): [[number, number], [number, number]] {
    return [
      [Math.min(...quad.map((p) => p[0])), Math.min(...quad.map((p) => p[1]))],
      [Math.max(...quad.map((p) => p[0])), Math.max(...quad.map((p) => p[1]))],
    ];
  },

  // COCO bbox [x, y, w, h] → [[x1,y1],[x2,y2]]
  cocoBoxToPoints(
    box: [number, number, number, number],
  ): [[number, number], [number, number]] {
    const [x, y, w, h] = box;
    return [
      [x, y],
      [x + w, y + h],
    ];
  },

  // YOLO normalized [cx, cy, w, h] → [[x1,y1],[x2,y2]] in pixel coords
  yoloBoxToPoints(
    box: [number, number, number, number],
    imgW: number,
    imgH: number,
  ): [[number, number], [number, number]] {
    const [cx, cy, w, h] = box;
    return [
      [(cx - w / 2) * imgW, (cy - h / 2) * imgH],
      [(cx + w / 2) * imgW, (cy + h / 2) * imgH],
    ];
  },

  // flat COCO segmentation array [x1,y1,x2,y2,...] → [[x,y],[x,y],...]
  cocoSegToPoints(seg: number[]): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i < seg.length; i += 2) pts.push([seg[i], seg[i + 1]]);
    return pts;
  },
};
```

Everything else — field name mapping, label resolution, confidence normalization,
source normalization — is the client webapp's problem. The harness adapters in
`harness/lib/adapters.ts` are reference examples showing how a client webapp should
be structured. They are not library code and are never imported by the package.

**Boundary rule:** If a function needs to know that a field is called `matched_code`
or `category_id` or `label_id`, it belongs in the client webapp, not the package.

---

Konva touches `window` at import time. The package itself must never import konva
or react-konva at the module's top level in a way that breaks SSR.

Rules:

- All konva/react-konva imports stay inside component files, never in utils or types
- The harness always imports AnnotationCanvas via `dynamic` with `ssr: false`
- The package does NOT do the dynamic import itself — that is the consumer's job
- No `window`, `document`, or `navigator` references at module load time anywhere in the package

---

## Design System

The annotation UI follows the same design language as CVAT and Roboflow. This is a
professional tool for engineers and estimators — it is not a consumer product. The
design prioritizes canvas space, reduces chrome to the minimum, and uses a dark theme
so that colorful annotations pop against the background.

### Color Palette

```
--ae-bg-base:       #141414   /* outermost background */
--ae-bg-surface:    #1e1e1e   /* panels, sidebars */
--ae-bg-elevated:   #2a2a2a   /* hover states, dropdowns */
--ae-bg-canvas:     #0f0f0f   /* the canvas stage background */
--ae-border:        #333333   /* panel borders, dividers */
--ae-border-subtle: #2a2a2a   /* subtle separators */
--ae-text-primary:  #e8e8e8   /* main text */
--ae-text-secondary:#8a8a8a   /* labels, hints, secondary info */
--ae-text-muted:    #555555   /* disabled, placeholders */
--ae-accent:        #2563eb   /* active tool, selections, focus rings */
--ae-accent-hover:  #1d4ed8   /* accent hover */
--ae-danger:        #ef4444   /* delete actions */
--ae-success:       #22c55e   /* confirmation states */
--ae-handle-fill:   #ffffff   /* annotation handle fill */
--ae-selection:     rgba(37, 99, 235, 0.15)  /* selection overlay */
```

### Typography

- UI font: `system-ui, -apple-system, 'Segoe UI', sans-serif`
- Coordinate/confidence display: `'JetBrains Mono', 'Fira Code', monospace`
- Base size: 13px
- Labels on annotations: 11px
- Panel headers: 11px uppercase, letter-spacing 0.08em, `--ae-text-secondary`

### Layout

The component fills its container. Layout is always:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar (left, 48px wide, icons only)                  │
│  ┌────┬──────────────────────────────────┬────────────┐ │
│  │    │                                  │            │ │
│  │    │                                  │  Label     │ │
│  │ T  │         Canvas Stage             │  Panel     │ │
│  │ o  │         (fills space)            │  (right,   │ │
│  │ o  │                                  │  220px)    │ │
│  │ l  │                                  │            │ │
│  │ s  │                                  │            │ │
│  │    │                                  │            │ │
│  └────┴──────────────────────────────────┴────────────┘ │
│  Status bar (bottom, 28px, zoom % + cursor coords)      │
└─────────────────────────────────────────────────────────┘
```

- Toolbar: 48px wide, icons vertically stacked with 4px gap, centered
- Canvas: flexes to fill remaining space
- Label panel: 220px fixed, scrollable annotation list
- Status bar: shows zoom level left, cursor pixel coords right

### Toolbar Icons

Use Lucide icons. Map tools to icons exactly:

| Tool    | Icon            | Keyboard shortcut |
| ------- | --------------- | ----------------- |
| select  | `MousePointer2` | `V` or `Esc`      |
| bbox    | `Square`        | `B`               |
| polygon | `Pentagon`      | `P`               |
| line    | `Minus`         | `L`               |
| point   | `Crosshair`     | `N` (like CVAT)   |

Active tool has `--ae-accent` background with 6px border-radius.
Icons are 18px. Toolbar buttons are 36x36px.
Show keyboard shortcut as a tooltip on hover (not inline text).

---

## Tool Behaviors

These are the exact behaviors to implement. Reference CVAT's interaction model.

### Select Tool (`V` / `Esc`)

- Click on an annotation to select it. Selected annotation gets handles.
- Click on empty canvas to deselect.
- Drag a selected annotation to move it.
- `Delete` or `Backspace` to delete selected annotation.
- Hover over annotation shows it highlighted (2px brighter stroke).
- `Escape` cancels any in-progress drawing and returns to select.
- Cannot select while another tool is mid-draw.

### BBox Tool (`B`)

- Click and drag to draw rectangle. Show live preview while dragging.
- On mouse-up: show label selector popover, user picks a label, annotation is committed.
- If user presses Escape during draw: cancel and return to select.
- Selected bbox shows 8 handles: 4 corners + 4 edge midpoints.
  - Corner handles: resize freely
  - Edge handles: resize along one axis
  - Handle size: 7px radius circles, white fill, annotation-color stroke, 2px stroke width
- Minimum bbox size: 8x8px. If smaller on release, discard.

### Polygon Tool (`P`)

- Each click adds a vertex. Show line connecting to cursor from last vertex (live rubber-band line).
- Show placed vertices as small circles (4px radius, white fill).
- Close polygon by clicking the first vertex (show green highlight when hovering near it, within 10px).
- Also close by pressing `Enter`.
- Minimum 3 vertices before closing is allowed.
- After closing: show label selector popover, commit on label pick.
- Press `Escape` to cancel entire polygon in progress.
- Selected polygon shows all vertex handles (5px radius, draggable).
- Drag vertex handle to move individual points (edit mode).

### Line Tool (`L`)

- Click to place start point, click again to place end point. Two-click draw.
- Show live rubber-band line from start to cursor while waiting for second click.
- On second click: show label selector popover, commit on label pick.
- Press `Escape` to cancel.
- Selected line shows handles at both endpoints.

### Point Tool (`N`)

- Single click to place a point. Immediately show label selector popover.
- Render as a circle (8px radius, annotation color fill, 2px white stroke).
- Press `Escape` to cancel.
- No resize handles — only move by dragging.

### Label Selector Popover

- Appears at the location of the last drawn point/release.
- Shows all labels from the `labels` prop as a searchable list.
- Each row: color dot + displayName.
- Type to filter. Arrow keys to navigate. Enter to select.
- Escape to cancel (discards the annotation in progress).
- If only one label exists in the registry, auto-select it, skip the popover.

---

## Annotation Rendering

### Styles by State

```
Default (engine annotation):
  stroke: label.color
  strokeWidth: 1.5
  fill: transparent (bbox/polygon get rgba(color, 0.08) fill)

Default (human annotation):
  stroke: label.color
  strokeWidth: 2
  fill: transparent (bbox/polygon get rgba(color, 0.12) fill)

Hover:
  strokeWidth: 2.5
  fill: rgba(color, 0.15)
  cursor: pointer (select tool) or crosshair (drawing tool)

Selected:
  stroke: label.color
  strokeWidth: 2
  fill: rgba(color, 0.18)
  + render handles

Engine annotation (unedited, source='engine'):
  strokeDashArray: none
  opacity: 0.85

Human annotation (source='human'):
  strokeDashArray: none
  opacity: 1.0
```

### Label Chip

Every annotation renders a small label chip at its top-left corner (or near
the centroid for polygons). Do not render chips when zoom is below 30%.

```
┌──────────────────────────┐
│ ● Door    92%            │
└──────────────────────────┘
```

- Background: rgba(0,0,0,0.65)
- Color dot: 6px circle in label.color
- Text: displayName in `--ae-text-primary`, 11px
- Confidence: shown only when `confidence` is defined, monospace, `--ae-text-secondary`
- Padding: 2px 6px, border-radius 3px

---

## Canvas Interaction (Zoom / Pan)

- **Scroll wheel**: zoom centered on cursor position
- **Space + drag**: pan
- **Middle mouse drag**: pan
- **`Cmd/Ctrl + 0`**: fit image to canvas (scale to fit, centered)
- **`Cmd/Ctrl + =`**: zoom in
- **`Cmd/Ctrl + -`**: zoom out
- Min zoom: 5%. Max zoom: 2000%.
- Zoom is applied to the Konva Stage via `scaleX`/`scaleY` + `x`/`y` position.
- Status bar shows current zoom %, updates live.
- Status bar shows cursor position in image pixel coordinates (not screen coords).

---

## Label Panel (Right Sidebar)

Shows a list of all current annotations grouped by label.

```
┌─────────────────────┐
│ ANNOTATIONS    [14] │    ← count badge
├─────────────────────┤
│ ● Door          (3) │    ← clickable group header
│   #ae-001  bbox     │    ← individual annotation row
│   #ae-002  bbox  ✎  │    ← hovered row shows edit icon
│   #ae-003  polygon  │
├─────────────────────┤
│ ● Window        (5) │
│   ...               │
└─────────────────────┘
```

- Clicking an annotation row selects it on canvas (pans to it if out of view).
- Clicking a group header toggles collapse.
- `✎` icon on hover opens label re-assignment (same label selector popover).
- Delete icon on hover deletes annotation.
- Human-added annotations (source='human') show a small `H` badge.
- Engine annotations (source='engine') show a small `AI` badge.

---

## State Management

Keep all state local inside `AnnotationCanvas`. No external state library.
Use `useReducer` for annotation state (array of `CanonicalAnnotation`).

Actions:

```typescript
type Action =
  | { type: "LOAD"; payload: CanonicalAnnotation[] }
  | { type: "ADD"; payload: CanonicalAnnotation }
  | { type: "UPDATE"; payload: CanonicalAnnotation }
  | { type: "DELETE"; id: string }
  | { type: "MOVE"; id: string; delta: [number, number] };
```

Fire `onChange` after every dispatch.
Fire `onSave` only when user explicitly clicks Save (button in header or `Ctrl+S`).

---

## Mock Fixtures for the Harness

Create these fixtures before implementing any component.

### harness/fixtures/engine-a.json (COCO format)

```json
{
  "images": [{ "id": 1, "width": 2400, "height": 1800 }],
  "annotations": [
    { "id": 1, "category_id": 3, "bbox": [120, 200, 80, 120], "score": 0.94 },
    { "id": 2, "category_id": 1, "bbox": [400, 300, 200, 150], "score": 0.87 },
    {
      "id": 3,
      "category_id": 2,
      "segmentation": [[600, 400, 700, 400, 720, 500, 580, 510]],
      "score": 0.76
    }
  ],
  "categories": [
    { "id": 1, "name": "ROOM_AREA" },
    { "id": 2, "name": "WALL_SEGMENT" },
    { "id": 3, "name": "DR_OPENING" }
  ]
}
```

### harness/fixtures/engine-b.json (YOLO format)

```json
{
  "image_width": 2400,
  "image_height": 1800,
  "detections": [
    {
      "class": "door_opening",
      "cx": 0.067,
      "cy": 0.172,
      "w": 0.033,
      "h": 0.067,
      "confidence": 0.91
    },
    {
      "class": "room",
      "cx": 0.25,
      "cy": 0.25,
      "w": 0.083,
      "h": 0.083,
      "confidence": 0.88
    }
  ]
}
```

### harness/fixtures/engine-c.json (arbitrary custom format)

```json
{
  "results": [
    {
      "type": "bbox",
      "label_id": 42,
      "x1": 120,
      "y1": 200,
      "x2": 200,
      "y2": 320,
      "conf": 0.94
    },
    {
      "type": "poly",
      "label_id": 7,
      "vertices": [
        [600, 400],
        [700, 400],
        [720, 500],
        [580, 510]
      ],
      "conf": 0.76
    }
  ],
  "label_schema": {
    "42": "DOOR",
    "7": "WALL"
  }
}
```

### harness/fixtures/label-registry.ts

```typescript
import type { LabelMap } from "@neura/annotation-engine";

export const labelRegistry: LabelMap[] = [
  {
    canonicalClassId: "door",
    displayName: "Door",
    color: "#FF6B6B",
    defaultTool: "bbox",
  },
  {
    canonicalClassId: "window",
    displayName: "Window",
    color: "#4ECDC4",
    defaultTool: "bbox",
  },
  {
    canonicalClassId: "wall",
    displayName: "Wall",
    color: "#FFE66D",
    defaultTool: "polygon",
  },
  {
    canonicalClassId: "room",
    displayName: "Room",
    color: "#A8E6CF",
    defaultTool: "polygon",
  },
  {
    canonicalClassId: "column",
    displayName: "Column",
    color: "#B8B8FF",
    defaultTool: "point",
  },
  {
    canonicalClassId: "stair",
    displayName: "Stair",
    color: "#FF9A9E",
    defaultTool: "polygon",
  },
];
```

### harness/fixtures/engine-d.json (quad bbox — 4 corner points, real format observed in production)

```json
{
  "annotations": {
    "schedule_codes": [
      {
        "text": "Thermostat",
        "matched_code": "Thermostat",
        "bbox": [
          [7433.17, 2979.23],
          [7549.84, 2979.23],
          [7549.84, 3095.89],
          [7433.17, 3095.89]
        ],
        "confidence": 1,
        "source": "Human"
      },
      {
        "text": "Thermostat",
        "matched_code": "Thermostat",
        "bbox": [
          [7426.92, 3277.14],
          [7526.92, 3277.14],
          [7526.92, 3389.64],
          [7426.92, 3389.64]
        ],
        "confidence": 0.91,
        "source": "Engine"
      }
    ]
  }
}
```

Note: engine-d is a real engine format. Coords are in the 7000s — this is a full-res
construction drawing. The adapter must use `geo.quadToPoints()` for coord conversion.
`source: "Human"` must map to canonical `source: 'human'`, confidence 1 with Human
source maps to `confidence: undefined` (humans don't have model confidence).

### harness/lib/adapters.ts

Write four adapters — one per engine format — that convert each fixture into
`CanonicalAnnotation[]`. Use `geo` utilities from the package for all coordinate math.

These are REFERENCE IMPLEMENTATIONS for client webapps. Comments in this file should
explain the pattern clearly so a developer onboarding a new client can copy and adapt.
Mark the file with a prominent warning:

```typescript
/**
 * REFERENCE ONLY — not exported by @neura/annotation-engine
 *
 * This file shows how a CLIENT WEBAPP should write its own adapter.
 * Copy the pattern, adapt the field names to your engine's schema.
 * The package (`@neura/annotation-engine`) has no adapters.
 * Adapters live exclusively in the consuming webapp.
 */
```

---

## Harness Page

`harness/app/page.tsx` should render the full annotation environment with:

1. A fixture selector at the top (Engine A / Engine B / Engine C / Engine D) that
   hot-swaps the annotation source to verify all four adapters work.
2. The `AnnotationCanvas` filling the remaining viewport height.
3. A console log on `onSave` that prints the full `CanonicalAnnotation[]` array.
4. Use a real architectural floor plan image from Wikimedia Commons or similar
   as the background image. Hardcode the URL.
5. Engine D's fixture has coords in the 7000–9000 range. The canvas must call
   fit-to-screen on image load so the user does not open to a blank canvas.

---

## Build Order — Follow This Exactly

Do not skip steps or reorder. Each step's output is used by the next.

1. **Scaffold** — monorepo, install deps, workspace link, verify `npm run dev` starts
2. **Types + geo utils + fixtures** — canonical.ts, geometry.ts (with `geo` export), all four fixture files, adapters.ts (reference), label-registry.ts
3. **Stage** — AnnotationCanvas shell: Konva Stage, image layer, zoom/pan, fit-to-screen on load, status bar
4. **BBox tool** — draw, handles, move, delete, label popover
5. **Select tool** — click-to-select, drag-to-move, keyboard delete, hover states
6. **Polygon tool** — vertex placement, rubber-band line, close detection, vertex editing
7. **Line + Point tools** — both simpler, reuse patterns from bbox/polygon
8. **Toolbar + keyboard shortcuts** — all tool switching, hotkeys, active state
9. **Label panel** — right sidebar, grouped list, click-to-select, badges
10. **Wire harness** — fixture selector, onSave log, verify all four adapters end-to-end

---

## Constraints

- **No external UI library** (no shadcn, no MUI, no Chakra). Raw CSS with CSS variables.
- **No global styles**. All styles scoped to the component via CSS modules or inline styles.
- **Konva only for canvas**. No SVG overlays, no DOM elements positioned over the canvas.
- **TypeScript strict mode**. No `any`. `unknown` where type is genuinely unknown.
- **No `useEffect` for state sync**. Use `useReducer` + `onChange` callback.
- **Image coordinates only**. All `CanonicalAnnotation.points` values are in image pixel
  space, not screen/stage space. Convert on the way in (screen → image) and out (image → screen).
- **The package exports nothing except what is listed in the Component API section.**
  Internal components, tools, and ids.ts are not exported.
- **The package contains NO adapters and NO knowledge of any CV engine's output format.**
  The only data-transformation export is `geo` — pure coordinate math, zero schema knowledge.
  Any function that references an engine-specific field name belongs in the client webapp.
- **Minimum viable keyboard nav**: Tab through toolbar buttons, Enter to activate,
  Escape to cancel. Full keyboard operation for power users.
