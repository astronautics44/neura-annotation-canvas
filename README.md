# @astronautics44/neura-annotation-canvas

A professional-grade React annotation component for reviewing and correcting CV engine output on construction drawings. Built for the same use-case class as CVAT and Roboflow — canvas-first, keyboard-driven, designed for engineers doing quantity takeoffs.

For consumer installation and app integration, see [`docs/INSTALLATION.md`](docs/INSTALLATION.md).
For making changes and publishing a new version, see [`docs/RELEASING.md`](docs/RELEASING.md).

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
├── package/          ← the publishable library (@astronautics44/neura-annotation-canvas)
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

## Publishing to GitHub Packages

This repository publishes `@astronautics44/neura-annotation-canvas` to **GitHub Packages** as a **private** (`restricted`) package. Publishing runs automatically when a GitHub Release is published, or manually via **Actions → Publish Package → Run workflow**.

### One-time org setup

1. **Package scope must match the GitHub owner** of this repo. If the repo lives under `github.com/MyOrg/...`, rename the package to `@MyOrg/neura-annotation-canvas` everywhere (scope in `package.json`, `.npmrc`, workflow, and consumer apps).
2. In the org: **Settings → Packages** — ensure members can publish/read packages.
3. In the repo: **Settings → Actions → General** — allow workflows to write packages (the workflow uses `GITHUB_TOKEN` with `packages: write`).

### Publish a new version

1. Bump `version` in `package/package.json` (e.g. `0.1.4` → `0.1.5`).
2. Commit and push.
3. Create a GitHub Release tagged with that version (e.g. `v0.1.5`), or run the workflow manually from the Actions tab.

### Install in another private repo (consumer)

Each developer/CI job needs a token with `read:packages` (and `repo` if the package repo is private).

```ini
# consumer-app/.npmrc  (do not commit the token — use env var in CI)
@astronautics44:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
npm install @astronautics44/neura-annotation-canvas
```

For local dev, create a [Personal Access Token](https://github.com/settings/tokens) with `read:packages` and export it:

```bash
export NODE_AUTH_TOKEN=ghp_...
npm install
```

In GitHub Actions (consumer repo):

```yaml
- uses: actions/setup-node@v4
  with:
    registry-url: https://npm.pkg.github.com
    scope: "@astronautics44"
- run: npm ci
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Installation in a client webapp

For step-by-step consumer setup, including GitHub Packages auth, installation, labels, adapters, Next.js usage, and save handling, see [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

---

## Quick start

```tsx
// app/review/page.tsx
import dynamic from "next/dynamic";
import type { LabelMap } from "@astronautics44/neura-annotation-canvas";
import { adaptEngineOutput } from "@/lib/annotation.adapter"; // YOUR adapter
import { labelRegistry } from "@/lib/annotation.labels"; // YOUR label config

// Always load via dynamic — Konva touches `window` at import time
const AnnotationCanvas = dynamic(
  () =>
    import("@astronautics44/neura-annotation-canvas").then(
      (m) => m.AnnotationCanvas,
    ),
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
  image: string; // URL or base64 data URL
  labels: LabelMap[]; // full label registry; use symbolSize per label for manual size form

  // Data
  annotations?: CanonicalAnnotation[]; // pre-adapted engine output, loaded on mount
  onSave: (annotations: CanonicalAnnotation[]) => void;
  onChange?: (annotations: CanonicalAnnotation[]) => void; // fires on every mutation
  onLabelsChange?: (labels: LabelMap[]) => void; // fires when user creates a new label

  // Tools
  tools?: ToolType[]; // subset to expose; default: all ["select","bbox","polygon","line","point","circle"]

  // Behavior
  readonly?: boolean; // disables all editing; view mode only

  // Feature toggles — all default to true
  showZoomControls?: boolean; // zoom-in / zoom-out / fit buttons in the status bar
  showUndoRedo?: boolean;     // undo / redo buttons in the toolbar
  enableSelectAll?: boolean;  // Ctrl/Cmd+A selects all annotations
  showFullscreen?: boolean;   // fullscreen toggle button in the status bar

  // Label chip visibility
  labelVisibility?: "always" | "hover" | "selected" | "hover+selected"; // default: "always"

  // Polyline
  polylineFinishAction?: "enter" | "right-click" | "double-click"; // default: "enter"

  // Drawing scale — enables real-world dimension display on annotation chips
  dpi?: number;                                       // scanner resolution (dots per inch)
  drawingScale?: DrawingScale;                        // CV-extracted or user-set drawing scale
  onDrawingScaleChange?: (s: DrawingScale) => void;   // fires when user overrides the scale

  // Layout
  className?: string; // applied to the outer container div

  // Theming
  theme?: Partial<ThemeVars>; // override any design token; see Theming section
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

export type ToolType = "select" | "bbox" | "polygon" | "line" | "point" | "circle";

export type AnnotationType = "bbox" | "polygon" | "line" | "point" | "circle";

export interface CanonicalAnnotation {
  id: string; // nanoid, generated on creation
  type: AnnotationType;
  points: [number, number][]; // always image pixel coords:
  //   bbox:    [[x1,y1],[x2,y2]]
  //   polygon: [[x,y],[x,y],...] (open — no duplicate last point)
  //   line:    [[x1,y1],[x2,y2]]
  //   point:   [[x,y]]
  //   circle:  [[x1,y1],[x2,y2]]  bounding box of the circle;
  //            cx=(x1+x2)/2, cy=(y1+y2)/2, r=(x2-x1)/2
  label: string; // canonicalClassId, e.g. "door"
  confidence?: number; // 0–1. undefined = human-created annotation
  source: "engine" | "human"; // engine = from CV output; human = added/modified by reviewer
  meta?: Record<string, unknown>; // passthrough; package reads meta.symbolSize for display
}

export type SymbolSizeUnit = "mm" | "cm" | "m" | "in" | "ft";

/** Manual real-world size stored in annotation.meta.symbolSize */
export interface SymbolSize {
  attribute: string; // e.g. "diameter", "thickness"
  value: number;
  unit: SymbolSizeUnit;
}

export interface LabelMap {
  canonicalClassId: string; // internal ID used everywhere, e.g. "door"
  displayName: string; // shown in UI, e.g. "Door"
  color: string; // hex, e.g. "#FF6B6B"
  defaultTool?: AnnotationType; // auto-selects this tool when label is picked
  symbolSize?: "optional" | "required"; // show manual size form in label popover
  symbolSizeAttributes?: string[]; // attribute dropdown options for this label
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

import { geo } from "@astronautics44/neura-annotation-canvas";
import type { CanonicalAnnotation } from "@astronautics44/neura-annotation-canvas";

// Step 1: type your engine's output exactly as it arrives
type EngineApiResponse = {
  detections: Array<{
    class: string;
    cx: number;
    cy: number;
    w: number;
    h: number;
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
export function adaptEngineOutput(
  raw: EngineApiResponse,
): CanonicalAnnotation[] {
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

| Adapter        | Engine format                  | Key technique                                |
| -------------- | ------------------------------ | -------------------------------------------- |
| `adaptEngineA` | COCO (`bbox` + `segmentation`) | `geo.cocoBoxToPoints`, `geo.cocoSegToPoints` |
| `adaptEngineB` | YOLO normalized `[cx,cy,w,h]`  | `geo.yoloBoxToPoints`                        |
| `adaptEngineC` | Arbitrary custom JSON          | direct coord pass-through                    |
| `adaptEngineD` | Quad bbox (4 corner points)    | `geo.quadToPoints`, `source:"Human"` mapping |

Copy and adapt those patterns — don't import from `harness/`.

---

## `geo` — coordinate math utilities

Exported from the package for use in your adapters. All functions are pure, schema-free math.

```typescript
import { geo } from "@astronautics44/neura-annotation-canvas";

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
import type { ThemeVars } from "@astronautics44/neura-annotation-canvas";
import { DEFAULT_THEME } from "@astronautics44/neura-annotation-canvas";

interface ThemeVars {
  // Backgrounds
  bgBase: string; // outermost container        default: #141414
  bgSurface: string; // toolbar, panels, status bar default: #1e1e1e
  bgElevated: string; // hover states, dropdowns     default: #2a2a2a
  bgCanvas: string; // the Konva stage background  default: #0f0f0f

  // Borders
  border: string; // panel borders, dividers     default: #333333
  borderSubtle: string; // subtle separators           default: #2a2a2a

  // Text
  textPrimary: string; // main content text           default: #e8e8e8
  textSecondary: string; // labels, hints               default: #8a8a8a
  textMuted: string; // disabled, placeholders      default: #555555

  // Brand / interaction
  accent: string; // active tool, focus rings, in-progress drawing  default: #2563eb
  accentHover: string; // accent on hover             default: #1d4ed8
  danger: string; // delete buttons              default: #ef4444
  success: string; // polygon close indicator     default: #22c55e
  handleFill: string; // resize/vertex handle fill   default: #ffffff
  selection: string; // selected row overlay (rgba) default: rgba(37,99,235,0.15)

  // Layout dimensions (px)
  toolbarWidth: number; // left toolbar width    default: 48
  panelWidth: number; // right label panel     default: 260
  statusBarHeight: number; // bottom status bar     default: 28
}
```

### Applying a custom theme

Pass any subset of `ThemeVars` — unset keys fall back to defaults:

```tsx
import type { ThemeVars } from "@astronautics44/neura-annotation-canvas";

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
  --ae-accent: #7c3aed;
  --ae-bg-base: #ffffff;
  --ae-text-primary: #111827;
  /* etc. */
}
```

```tsx
<div className="my-annotation-container">
  <AnnotationCanvas ... />
</div>
```

### All CSS variable names

| Token           | CSS variable          |
| --------------- | --------------------- |
| `bgBase`        | `--ae-bg-base`        |
| `bgSurface`     | `--ae-bg-surface`     |
| `bgElevated`    | `--ae-bg-elevated`    |
| `bgCanvas`      | `--ae-bg-canvas`      |
| `border`        | `--ae-border`         |
| `borderSubtle`  | `--ae-border-subtle`  |
| `textPrimary`   | `--ae-text-primary`   |
| `textSecondary` | `--ae-text-secondary` |
| `textMuted`     | `--ae-text-muted`     |
| `accent`        | `--ae-accent`         |
| `accentHover`   | `--ae-accent-hover`   |
| `danger`        | `--ae-danger`         |
| `success`       | `--ae-success`        |
| `handleFill`    | `--ae-handle-fill`    |
| `selection`     | `--ae-selection`      |

---

## Tool reference

### Toolbar layout

```
┌────────────────────────────────────────────────────────────┐
│  Toolbar (left, 48px)    Canvas    Label Panel (220px)     │
│  ┌────┬──────────────────────────────────────┬──────────┐  │
│  │ V  │                                      │          │  │
│  │ B  │     Konva canvas stage               │  Annot.  │  │
│  │ P  │     (fills remaining space)          │  list    │  │
│  │ L  │                                      │          │  │
│  │ N  │                                      │          │  │
│  │ C  │                                      │          │  │
│  │────│                                      │          │  │
│  │ H  │  [Reset View] overlay when           │          │  │
│  │────│  image is panned out of sight        │          │  │
│  │ ↺  │                                      │          │  │
│  │ ↻  │                                      │          │  │
│  └────┴──────────────────────────────────────┴──────────┘  │
│  Status bar — Zoom: 100%  [⊡] [−] [+]          x: 0 y: 0  │
└────────────────────────────────────────────────────────────┘
```

- Undo (↺) and Redo (↻) buttons appear below the Hand tool when `showUndoRedo` is true (default).
- Zoom buttons (fit ⊡, zoom-out −, zoom-in +) appear in the status bar when `showZoomControls` is true (default).
- A **Reset View** button floats in the centre of the canvas whenever the image is panned entirely out of view.

### Tools and keyboard shortcuts

| Tool       | Key          | Icon      | Behavior                                                                    |
| ---------- | ------------ | --------- | --------------------------------------------------------------------------- |
| Select     | `V` or `Esc` | cursor    | Click to select, drag to move, `Delete`/`Backspace` to remove               |
| BBox       | `B`          | square    | Click-drag to draw rectangle; label popover on release                      |
| Polygon    | `P`          | pentagon  | Click to place vertices; close by clicking first vertex or pressing `Enter` |
| Line       | `L`          | minus     | Two-click draw; label popover on second click                               |
| Point      | `N`          | crosshair | Single click; label popover immediately                                     |
| Circle     | `C`          | circle    | Click sets center, drag sets radius; label popover on release               |
| Hand (pan) | `H`          | hand      | Toggle pan mode; also `Space`+drag or middle-mouse drag                     |

### Canvas navigation

| Action          | Input                                             |
| --------------- | ------------------------------------------------- |
| Zoom in/out     | Scroll wheel (centered on cursor)                 |
| Pan             | `Space` + drag, or middle-mouse drag, or `H` tool |
| Fit to screen   | `Cmd/Ctrl` + `0`, or fit button (⊡) in status bar |
| Zoom in         | `Cmd/Ctrl` + `=`, or + button in status bar       |
| Zoom out        | `Cmd/Ctrl` + `-`, or − button in status bar       |
| Select all      | `Cmd/Ctrl` + `A` (when `enableSelectAll` is true) |
| Save            | `Cmd/Ctrl` + `S`                                  |
| Undo            | `Cmd/Ctrl` + `Z`, or ↺ button in toolbar          |
| Redo            | `Cmd/Ctrl` + `Shift` + `Z` / `Ctrl+Y`, or ↻ button |
| Cancel draw     | `Escape`                                          |
| Delete selected | `Delete` or `Backspace` (works with multi-select) |

Zoom range: 5% – 2000%. The status bar shows the current zoom and cursor position in image pixel coordinates.

### Multi-select

When `enableSelectAll` is true (default), `Ctrl/Cmd+A` selects all annotations simultaneously. With multiple annotations selected:

- All selected annotations highlight (filled state, no resize handles)
- `Delete` / `Backspace` deletes the entire selection in a single undo step
- Dragging a selected annotation moves **all** selected annotations together
- Clicking any single annotation (or empty canvas) collapses back to a single/no selection

---

## Feature toggles

All three toggles default to `true`. Set any to `false` to hide the feature from that client.

```tsx
// Full feature set (default)
<AnnotationCanvas
  showZoomControls={true}   // zoom in/out/fit buttons in status bar
  showUndoRedo={true}       // undo/redo buttons in toolbar (Ctrl+Z still works)
  enableSelectAll={true}    // Ctrl+A selects all annotations
  ...
/>

// View-only embed — minimal chrome
<AnnotationCanvas
  readonly={true}
  showZoomControls={false}
  showUndoRedo={false}
  enableSelectAll={false}
  tools={["select"]}
  ...
/>

// Disable circle tool (e.g. if your workflow doesn't need it)
<AnnotationCanvas
  tools={["select", "bbox", "polygon", "line", "point"]}
  ...
/>
```

> **Note:** Disabling `showUndoRedo` hides the toolbar buttons but does **not** disable the `Ctrl+Z` / `Ctrl+Shift+Z` keyboard shortcuts. If you need to disable undo/redo entirely, combine `showUndoRedo={false}` with `readonly={true}`.

---

## Label chip visibility

Label chips (the color dot + display name + confidence % shown on each annotation) can be configured to appear only when the user is actively interacting with an annotation, rather than cluttering the canvas at all times.

### `labelVisibility` prop

```typescript
labelVisibility?: "always" | "hover" | "selected" | "hover+selected"
```

| Value              | When chips appear                                             |
| ------------------ | ------------------------------------------------------------- |
| `"always"`         | Whenever zoom ≥ 30% (default — current behavior)             |
| `"hover"`          | Only while the cursor is over the annotation                  |
| `"selected"`       | Only when the annotation is selected (clicked / focused)      |
| `"hover+selected"` | On hover **or** when selected — hidden otherwise              |

`"hover+selected"` is the recommended value for dense drawings where labels overlap and obscure the underlying geometry. `"always"` (the default) preserves existing behavior for backward compatibility.

### Examples

```tsx
// Default — always visible when zoom is sufficient
<AnnotationCanvas labelVisibility="always" ... />

// Show labels only while hovering (minimal clutter)
<AnnotationCanvas labelVisibility="hover" ... />

// Show labels only when annotation is selected
<AnnotationCanvas labelVisibility="selected" ... />

// Show on hover or selection — best for dense drawings
<AnnotationCanvas labelVisibility="hover+selected" ... />
```

---

## Polyline finish action

By default, a polyline in progress is committed by pressing `Enter`. This can be changed to right-click or double-click depending on your workflow or user preference.

### `polylineFinishAction` prop

```typescript
polylineFinishAction?: "enter" | "right-click" | "double-click"
```

| Value           | How to finish drawing                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| `"enter"`       | Press `Enter` (default)                                                                 |
| `"right-click"` | Right-click anywhere on the canvas                                                      |
| `"double-click"`| Click rapidly twice — second click commits without adding an extra vertex               |

The hint tooltip that follows the cursor while drawing always reflects the configured action, so users see the correct instruction regardless of mode.

`Escape` cancels and discards the polyline in progress regardless of which finish action is set.

### Examples

```tsx
// Default — press Enter to finish
<AnnotationCanvas polylineFinishAction="enter" ... />

// Right-click to finish (common in GIS / CAD tools)
<AnnotationCanvas polylineFinishAction="right-click" ... />

// Double-click to finish
<AnnotationCanvas polylineFinishAction="double-click" ... />
```

---

### Label selector popover

Appears after completing a draw gesture (or when relabeling). Supports:

- Typing to search/filter labels
- Arrow keys to navigate
- `Enter` to select, `Escape` to cancel (discards the annotation)
- If only one label exists and it has no `symbolSize` config, it is auto-selected — no popover shown
- If the typed name doesn't match any label, a **Create "..."** row appears (disabled in `readonly` mode)
- When the selected label has `symbolSize: "optional" | "required"`, a second step collects **Attribute**, **Value**, and **Unit** (see [Symbol size](#symbol-size-manual-takeoff-dimensions))

---

## Label panel (right sidebar)

Shows all annotations grouped by label. Features:

- Click an annotation row to select it on canvas (auto-pans if out of view)
- Click a group header to collapse/expand
- Hover a row to reveal relabel (✎) and delete (✕) actions
- Each annotation shows an `H` badge (human-created) or `AI` badge (engine output)
- When `meta.symbolSize` is set, the row shows the manual dimension (e.g. `diameter - 12mm`)
- When `dpi` and `drawingScale` are set, each row also shows the computed real-world size below the annotation ID (e.g. `4.25m` for a line, `0.90m × 2.10m` for a bbox)

---

## State management

All state lives inside `AnnotationCanvas`. No external store required.

- `onSave` fires only when the user explicitly saves (`Ctrl+S` or a Save button you add externally)
- `onChange` fires after every mutation (add, update, delete, move)
- `onLabelsChange` fires when the user creates a new label via the popover

Undo/redo history is kept in-memory (up to 100 steps). It resets when the `annotations` prop changes (e.g. when switching fixtures). The toolbar undo/redo buttons are automatically enabled/disabled based on history availability.

**Undo granularity:** each complete drag gesture (mousedown → mouseup) counts as one undo step, not one step per pixel moved. A snapshot is taken when the drag starts; intermediate positions during the drag are not pushed to history. Discrete actions (draw, delete, relabel, split segment) each produce their own undo step.

---

## Annotation rendering

Annotations render differently based on state and source:

| State            | Stroke width | Fill alpha | Opacity |
| ---------------- | ------------ | ---------- | ------- |
| Engine (default) | 1.5px        | 8%         | 85%     |
| Human (default)  | 2px          | 12%        | 100%    |
| Hovered          | 2.5px        | 15%        | —       |
| Selected         | 2px          | 18%        | —       |

Selected annotations show resize handles (bboxes: 8 handles at corners + edge midpoints; polygons: handles at every vertex; lines: handles at endpoints; circles: 4 cardinal handles — dragging any handle adjusts the radius while keeping the circle perfectly round).

### Splitting line / polyline segments

When a `line` or `polyline` is selected, a smaller accent-colored handle appears at the **midpoint of each segment**. Clicking it inserts a new vertex at that midpoint, splitting the segment in two. The new vertex can be dragged immediately to reshape the annotation. Splitting a `line` (two endpoints) promotes it to `polyline` in the output.

This is the primary way to add detail to an existing line or polyline without redrawing it from scratch.

Label chips (color dot + display name + confidence % + optional symbol size) are rendered at each annotation. They are hidden when zoom drops below 30%.

When `meta.symbolSize` is set, the chip also shows the manual dimension (e.g. `Pipe diameter 12mm`). This is independent of drawing-scale geometry.

---

## Symbol size (manual takeoff dimensions)

Symbol size lets reviewers type a real-world dimension when assigning or updating a label — pipe diameter, wall thickness, etc. It is **independent of drawing scale**. Drawing scale converts pixel geometry globally; symbol size is a per-annotation value the user enters manually.

### Label registry

Configure which labels show the size form:

```typescript
{
  canonicalClassId: "pipe",
  displayName: "Pipe",
  color: "#C9A0FF",
  defaultTool: "line",
  symbolSize: "required",                                     // or "optional"
  symbolSizeAttributes: ["diameter", "thickness", "radius"],  // optional override
}
```

| `symbolSize` | Behavior |
| ------------ | -------- |
| omitted      | No size form — label commits immediately |
| `"optional"` | Size form with **Skip** button |
| `"required"` | Size form — all three fields required |

Default attribute options (when `symbolSizeAttributes` is omitted): `diameter`, `thickness`, `width`, `height`, `depth`, `length`, `radius`, `gauge`. Users can also choose **Custom…** and type any name.

### Stored on the annotation

```typescript
import type { SymbolSize } from "@astronautics44/neura-annotation-canvas";

// annotation.meta.symbolSize
{ attribute: "diameter", value: 12, unit: "mm" }
```

Round-trips through `onSave` / `onChange`. CV engine output typically omits this — reviewers add it during review.

### Backend contract

| Direction | What to provide / persist |
| --------- | ------------------------- |
| Load labels | `symbolSize` and optional `symbolSizeAttributes` per label |
| Load annotations | `meta.symbolSize` when previously saved |
| Save annotations | Full `CanonicalAnnotation[]` including `meta.symbolSize` |

Optional validation: reject annotations missing `meta.symbolSize` when their label has `symbolSize: "required"`.

---

## Drawing scale

When a drawing scale and scanner DPI are provided, every annotation chip shows real-world dimensions alongside the label (computed from pixel geometry). Users can also correct a wrong CV-extracted scale directly in the status bar.

> **Not the same as [symbol size](#symbol-size-manual-takeoff-dimensions).** Symbol size is a manual value the user types per annotation when labeling.

### How it works

A construction drawing is scanned at a known DPI, and the drawing itself is at a known architectural scale (e.g. 1:100). Together these two numbers let the package convert any pixel distance into a real-world measurement:

```
real dimension = pixels × (scale.value × 25.4) / dpi   (metric)
real dimension = pixels × scale.value / dpi             (imperial)
```

### `DrawingScale` type

```typescript
import type { DrawingScale, ScaleSideInput } from "@astronautics44/neura-annotation-canvas";

interface ScaleSideInput {
  amount: string;  // numeric string; fractions allowed, e.g. "1/4"
  unit: "in" | "mm" | "cm" | "m" | "ft";
  inches?: string; // supplemental inches when unit is "ft", e.g. "0" for 1'-0"
}

interface DrawingScale {
  value: number;                            // real units per 1 paper unit (computed)
  unit: "mm" | "cm" | "m" | "in" | "ft";  // real-world unit for display
  label: string;                            // human-readable string shown in the status bar
  paper?: ScaleSideInput;                   // stored for round-trip editor display
  real?: ScaleSideInput;                    // stored for round-trip editor display
}
```

`value`/`unit` are the computed ratio used for all dimension math. `paper`/`real` are optional — include them if you want the built-in scale editor to pre-fill correctly when the user opens it.

### Common scale values

| Drawing convention | `value` | `unit` | `label`      |
| ------------------ | ------- | ------ | ------------ |
| 1:100 (metric)     | 100     | `"mm"` | `"1:100"`    |
| 1:50 (metric)      | 50      | `"mm"` | `"1:50"`     |
| 1:20 (metric)      | 20      | `"mm"` | `"1:20"`     |
| 1/4" = 1' (US)     | 48      | `"in"` | `'1/4"=1\''` |
| 1/8" = 1' (US)     | 96      | `"in"` | `'1/8"=1\''` |

> **Imperial `value`:** "1/4" = 1'" means 0.25 paper inches = 12 real inches → 1 paper inch = 48 real inches → `value: 48`.

To include `paper`/`real` so the editor round-trips correctly:

```typescript
// 1/8" = 1'-0" with round-trip editor support
const cvScale: DrawingScale = {
  value: 96,
  unit: "in",
  label: '1/8"=1\'',
  paper: { amount: "1/8", unit: "in" },
  real:  { amount: "1", unit: "ft", inches: "0" },
};
```

### Usage

```tsx
import type { DrawingScale } from "@astronautics44/neura-annotation-canvas";

// Scale extracted by your CV engine
const cvScale: DrawingScale = { value: 100, unit: "mm", label: "1:100" };

<AnnotationCanvas
  image={drawingUrl}
  labels={labelRegistry}
  annotations={canonical}
  dpi={300}                          // scanner resolution
  drawingScale={cvScale}             // CV-extracted scale (or last saved value)
  onDrawingScaleChange={(s) => {
    // persist the user's correction to your backend
    saveDrawingScale(drawingId, s);
  }}
  onSave={handleSave}
/>
```

### What the user sees

- **Annotation chips** show real-world dimensions next to the label:
  - BBox: `Door  92%  0.90m × 2.10m`
  - Circle: `Column  ⌀0.60m`
  - Line: `Wall  4.25m`
- **Status bar** shows the active scale and DPI: `Scale: 1:100 · 300 DPI`
- **Edit button (✎)** next to the scale label opens the scale editor. The editor shows **both sides** of the equality — paper measurement on the left, real-world measurement on the right. Both sides accept fraction notation (`1/8`) and architectural feet+inches (`1'-6"`). Press **Confirm** to apply, **Cancel** to close without change. `onDrawingScaleChange` fires with the corrected scale.
- In `readonly` mode the edit button is hidden.

### Scale correction flow

```
CV engine extracts scale → client passes drawingScale prop
                         ↓
     User notices dimensions look wrong
                         ↓
     User clicks ✎ in status bar → edits value + unit → Enter
                         ↓
     onDrawingScaleChange fires → client persists correction
                         ↓
     Annotation chips update immediately with corrected dimensions
```

---

## SSR / Next.js requirements

Konva touches `window` at import time. **Always load `AnnotationCanvas` with `dynamic` and `ssr: false`.**

```tsx
// Correct — the only way to use this in Next.js
const AnnotationCanvas = dynamic(
  () =>
    import("@astronautics44/neura-annotation-canvas").then(
      (m) => m.AnnotationCanvas,
    ),
  { ssr: false },
);
```

The package does not do this itself — SSR gating is the consumer's responsibility.

---

## What the package exports

```typescript
// package/src/index.ts

export { AnnotationCanvas };                              // the main component
export type { CanonicalAnnotation, LabelMap, SymbolSize, SymbolSizeUnit, ToolType }; // canonical types
export type { DrawingScale, ScaleSideInput };             // drawing scale types
export type { ThemeVars };                                // theme token interface
export { DEFAULT_THEME };                                 // the default dark palette, useful as a base
export { geo };                                           // coordinate math helpers for use in adapters
```

**Nothing else is exported.** Internal components (`Toolbar`, `LabelPanel`, etc.), the reducer, and utility functions are private to the package.

---

## Hard rules

These are constraints, not suggestions.

1. **Never import from `@astronautics44/neura-annotation-canvas` inside an adapter.** Your adapter imports `geo` and types, that's it. Schema field names (`matched_code`, `category_id`, etc.) never appear inside the package — only in your webapp.

2. **Always use `dynamic` + `ssr: false`** when importing `AnnotationCanvas` in Next.js. Skipping this breaks server rendering.

3. **All `points` values are image pixel coordinates.** Convert on the way in (engine coords → image px) and the package handles screen↔image transforms internally.

4. **`meta` is mostly passthrough.** The package stores it and returns it in `onSave`. The one exception is `meta.symbolSize`, which the package reads to display manual dimensions on chips and in the label panel. Use `meta` for any other engine-specific fields you need downstream.

5. **Do not modify `canonical.ts`.** It is the shared contract between the package and all client webapps. Changes there break every existing adapter.

---

## Label registry example

```typescript
// client-webapp/lib/annotation.labels.ts
import type { LabelMap } from "@astronautics44/neura-annotation-canvas";

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
    symbolSize: "optional",
  },
  {
    canonicalClassId: "pipe",
    displayName: "Pipe",
    color: "#C9A0FF",
    defaultTool: "line",
    symbolSize: "required",
    symbolSizeAttributes: ["diameter", "thickness", "radius"],
  },
  {
    canonicalClassId: "stair",
    displayName: "Stair",
    color: "#FF9A9E",
    defaultTool: "polygon",
  },
];
```

---

## Full integration example

```tsx
// client-webapp/app/review/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type {
  CanonicalAnnotation,
  LabelMap,
  ThemeVars,
} from "@astronautics44/neura-annotation-canvas";
import { adaptEngineOutput } from "@/lib/annotation.adapter";
import { labelRegistry as initialRegistry } from "@/lib/annotation.labels";

const AnnotationCanvas = dynamic(
  () =>
    import("@astronautics44/neura-annotation-canvas").then(
      (m) => m.AnnotationCanvas,
    ),
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
