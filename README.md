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
│       ├── utils/measure.ts           measure export (area / perimeter readout)
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

This repository publishes `@astronautics44/neura-annotation-canvas` to **GitHub Packages** as a **public** package. Publishing runs automatically when a GitHub Release is published, or manually via **Actions → Publish Package → Run workflow**.

> **Public here does not mean tokenless.** The GitHub Packages npm registry requires an access token for *every* download, including public packages — this is a registry limitation, not a setting. What "public" buys you is that consumers no longer need to be members of the `astronautics44` org: any GitHub account with a `read:packages` token can install. If you need a genuinely anonymous `npm install`, the package has to be published to npmjs.com instead.

### One-time org setup

1. **Package scope must match the GitHub owner** of this repo. If the repo lives under `github.com/MyOrg/...`, rename the package to `@MyOrg/neura-annotation-canvas` everywhere (scope in `package.json`, `.npmrc`, workflow, and consumer apps).
2. In the org: **Settings → Packages** — ensure members can publish/read packages.
3. In the repo: **Settings → Actions → General** — allow workflows to write packages (the workflow uses `GITHUB_TOKEN` with `packages: write`).
4. Make the package public: **org Packages tab → package → Package settings (gear) → Danger Zone → Change visibility → Public**. Package *permissions* inherit from the linked repo, but *visibility* does not — it must be set once, by hand, and cannot be reversed.

### Publish a new version

1. Bump `version` in `package/package.json` (e.g. `0.1.4` → `0.1.5`).
2. Commit and push.
3. Create a GitHub Release tagged with that version (e.g. `v0.1.5`), or run the workflow manually from the Actions tab.

### Install in a consumer app

Each developer/CI job needs a GitHub token with `read:packages`. Org membership is **not** required — the package is public, so any GitHub account's token works.

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
  annotations?: CanonicalAnnotation[]; // pre-adapted engine output; seeds state, see note below
  onSave: (annotations: CanonicalAnnotation[]) => void;
  onChange?: (annotations: CanonicalAnnotation[]) => void; // fires on every mutation
  onLabelsChange?: (labels: LabelMap[]) => void; // fires when user creates a new label; wiring it is what makes "Create" appear

  // Tools
  tools?: ToolType[]; // subset to expose; default: all ["select","bbox","polygon","line","point","circle"]

  // Behavior
  readonly?: boolean; // disables all editing; view mode only. Selection still works.

  // Selection — controlled, the same shape as activeLabel / onActiveLabelChange.
  // Omit selectedIds entirely and the component owns selection as it always has.
  selectedIds?: string[];                       // ids that should be selected
  onSelectionChange?: (ids: string[]) => void;  // canvas clicks, marquee, select-all, Escape
  revealSelection?: boolean;                    // pan to centre the selection when off screen; default: false

  // Feature toggles — all default to true
  showZoomControls?: boolean; // zoom-in / zoom-out / fit buttons in the status bar
  showUndoRedo?: boolean;     // undo / redo buttons in the toolbar
  enableSelectAll?: boolean;  // Ctrl/Cmd+A selects all annotations
  showFullscreen?: boolean;   // fullscreen toggle button in the status bar
  showAnnotationsPanel?: boolean; // annotations list panel on the right

  // Label chip visibility
  labelVisibility?: "always" | "hover" | "selected" | "hover+selected"; // default: "always"
  labelDisplayMode?: "chip" | "card"; // compact chip or expanded detail card; default: "chip"

  // Polyline / Count
  polylineFinishAction?: "enter" | "right-click" | "double-click"; // default: "enter"
  countFinishAction?: "enter" | "right-click" | "double-click";    // default: "enter"

  // Edge splitting on selected line / polyline / polygon
  edgeSplitMode?: "midpoint" | "anyPoint"; // default: "midpoint"

  // Deleting the 3rd vertex of a polygon: refuse, or degrade to an open shape
  polygonMinVertexAction?: "block" | "polyline" | "line"; // default: "block"

  // Pinned annotation class — new shapes commit with this label, no popover
  enableActiveLabel?: boolean;                          // master switch; default: true
  activeLabel?: string | null;                          // controlled pinned class
  defaultActiveLabel?: string;                          // initial pin when uncontrolled
  onActiveLabelChange?: (id: string | null) => void;    // fires when the pin changes
  showActiveLabelBar?: boolean;                         // pinned-class chip; default: true

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

### `annotations` is initial state, not a controlled prop

`AnnotationCanvas` owns its annotation state. The `annotations` prop **seeds** that
state — it is read when the component mounts, and re-read whenever the array's
**identity** changes (`!==` against the array the canvas is currently holding).
Re-seeding wipes the user's in-progress edits and the undo/redo history.

This matters because of how the guard works. The canvas skips the reload when the
incoming array is the exact array it last emitted through `onChange`, which makes
the common "feed onChange back in" pattern safe. It cannot skip a **new array
built during render**:

```tsx
// ✗ Infinite loop. A new array identity every render → re-seed → onChange →
//   parent setState → render → new array identity → …
//   In practice this hits React's "Maximum update depth exceeded" after a few
//   thousand renders.
<AnnotationCanvas annotations={raw.map(adaptEngineOutput)} ... />
```

```tsx
// ✓ Build the array once, and remount when the stored set genuinely changes.
const annotations = useMemo(() => adaptEngineOutput(raw), [raw]);

<AnnotationCanvas key={sheetId} annotations={annotations} ... />;
```

Also note `onChange` fires once on mount with the seeded array, before the user
has touched anything. If your parent stores that payload, expect that first call.

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

## `measure` — area & perimeter readout

Pure geometry functions for reading the size of any annotation. No canvas, no React, no engine schema — just math on `CanonicalAnnotation`. Nothing is computed unless you call it, so consumers that don't need measurements pay nothing.

```typescript
import { measure } from "@astronautics44/neura-annotation-canvas";

// One argument → image pixels
measure.area(ann); // 9600   (px²)
measure.perimeter(ann); // 400    (px)

// Second argument → real-world units (same dpi/drawingScale you pass the canvas)
measure.perimeter(ann, { dpi, drawingScale });
// → { value: 6.2, unit: "m", text: "6.20m" }   or null when scale is unset

measure.isAreaShape(ann); // true for bbox | polygon | circle
```

| Type       | `area`               | `perimeter`                    |
| ---------- | -------------------- | ------------------------------ |
| `bbox`     | w × h                | closed perimeter               |
| `circle`   | exact π·r²           | exact 2π·r                     |
| `polygon`  | shoelace, minus holes| every ring summed (outer + holes) |
| `line`     | 0                    | segment length                 |
| `polyline` | 0                    | total path length              |
| `point`    | 0                    | 0                              |

Compound shapes produced by the boolean ops (merge / subtract / intersect / hollow) are handled correctly: a donut's `area` subtracts the hole, and its `perimeter` counts both the outer and the inner boundary.

`RealMeasurement.value` is the raw number after unit promotion (mm → m at 1000, in → ft at 12); `unit` is bare (`"m"`); `text` is display-ready and includes `²` for areas.

Typical takeoff use:

```typescript
const takeoff = annotations.filter(measure.isAreaShape).map((ann) => ({
  id: ann.id,
  label: ann.label,
  area: measure.area(ann, { dpi, drawingScale })?.value ?? null,
  perimeter: measure.perimeter(ann, { dpi, drawingScale })?.value ?? null,
}));
```

The right-hand label panel also displays the perimeter as a `P` line under the measured size, whenever `dpi` and `drawingScale` are configured.

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
| Count      | `T`          | dots      | Click to place multiple points; finish action commits all with one label    |
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
| Pin class       | `1`–`9` pins the nth label (when `enableActiveLabel`) |
| Unpin class     | `0`, or ✕ on the class chip                       |

Zoom range: 5% – 2000%. The status bar shows the current zoom and cursor position in image pixel coordinates.

### Multi-select

When `enableSelectAll` is true (default), `Ctrl/Cmd+A` selects all annotations simultaneously. With multiple annotations selected:

- All selected annotations highlight (filled state, no resize handles)
- `Delete` / `Backspace` deletes the entire selection in a single undo step
- Dragging a selected annotation moves **all** selected annotations together
- Clicking any single annotation (or empty canvas) collapses back to a single/no selection

---

## Feature toggles

All of these default to `true`. Set any to `false` to hide the feature from that client.

```tsx
// Full feature set (default)
<AnnotationCanvas
  showZoomControls={true}     // zoom in/out/fit buttons in status bar
  showUndoRedo={true}         // undo/redo buttons in toolbar (Ctrl+Z still works)
  enableSelectAll={true}      // Ctrl+A selects all annotations
  showFullscreen={true}       // fullscreen toggle in status bar
  showAnnotationsPanel={true} // annotations list on the right
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

// Canvas-only — you render your own list beside it
<AnnotationCanvas
  showAnnotationsPanel={false}
  tools={["select", "bbox"]}
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

### `labelDisplayMode` prop

```typescript
labelDisplayMode?: "chip" | "card"
```

Controls *what* the overlay looks like when `labelVisibility` decides it should be shown. The two props are independent — visibility governs *when*, display mode governs *what*.

| Value    | Overlay                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| `"chip"` | Compact single-line chip: display name + confidence + symbol size + measured dimension (default) |
| `"card"` | Expanded detail card anchored above the annotation                                            |

The detail card renders a titled panel with a header row (display name) and a row per available field:

| Row          | Shown when                | Value                                                   |
| ------------ | ------------------------- | ------------------------------------------------------- |
| `Type`       | always                    | annotation type (`bbox`, `polygon`, …)                  |
| `Coords`     | always                    | top-left for bbox/circle, the point for `point`, centroid otherwise |
| `Size`       | bbox / circle             | `w×h` in image pixels                                   |
| `Points`     | polygon / polyline / line | vertex count                                            |
| `Confidence` | `confidence` is defined   | rounded percentage                                      |
| `Symbol`     | `meta.symbolSize` is set  | formatted manual symbol size                            |
| `Measured`   | `dpi` + `drawingScale` set | real-world dimension                                    |

The card is drawn in image space and scales inversely with zoom, so it stays a constant on-screen size. It flips below the annotation when there isn't room above, and clamps horizontally to stay inside the image bounds.

```tsx
// Default — compact chip
<AnnotationCanvas labelDisplayMode="chip" ... />

// Detail card, only for the annotation under the cursor —
// keeps a dense drawing readable while giving full detail on demand
<AnnotationCanvas labelDisplayMode="card" labelVisibility="hover" ... />
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

## Count tool (multi-point batch placement)

The count tool lets reviewers place multiple points in a single session and assign one label to all of them at once — eliminating the label popover after each individual click. This mirrors the polyline drawing flow but produces N separate `point` annotations sharing the same label.

**Workflow:**

1. Press `T` (or click the count tool in the toolbar)
2. Click anywhere on the canvas to place point markers — each click drops a dot
3. Commit with the configured finish action (default: `Enter`)
4. A single label popover appears — pick a label once
5. All placed points are committed as individual `point` annotations with that label in one undo step

### `countFinishAction` prop

```typescript
countFinishAction?: "enter" | "right-click" | "double-click"
```

Accepts the same values as `polylineFinishAction`. The cursor-following hint tooltip shows the current configured action and the running point count (`3 pts · Enter to finish · Esc to cancel`).

| Value           | How to commit                                                                   |
| --------------- | ------------------------------------------------------------------------------- |
| `"enter"`       | Press `Enter` (default)                                                         |
| `"right-click"` | Right-click anywhere on the canvas                                              |
| `"double-click"`| Click rapidly twice — second click commits without adding an extra point        |

### Output

Each placed point becomes a standard `CanonicalAnnotation` with `type: "point"`. They are indistinguishable from points created with the single-point tool and round-trip normally through `onSave` / `onChange`.

```typescript
// Placing 3 points with the count tool and label "column" produces:
[
  { id: "abc", type: "point", points: [[120, 80]],  label: "column", source: "human" },
  { id: "def", type: "point", points: [[340, 210]], label: "column", source: "human" },
  { id: "ghi", type: "point", points: [[560, 95]],  label: "column", source: "human" },
]
```

All three are added in a single undo step — `Ctrl+Z` removes the entire batch.

### Examples

```tsx
// Default — press Enter to finish counting
<AnnotationCanvas countFinishAction="enter" ... />

// Right-click to finish (frees Enter for other shortcuts)
<AnnotationCanvas countFinishAction="right-click" ... />

// Use different finish actions for polyline vs count
<AnnotationCanvas
  polylineFinishAction="enter"
  countFinishAction="right-click"
  ...
/>
```

---

### `edgeSplitMode` prop

```typescript
edgeSplitMode?: "midpoint" | "anyPoint"
```

Controls where a new vertex is inserted when splitting an edge of a selected `line`, `polyline`, or `polygon`. See [Splitting line / polyline / polygon edges](#splitting-line--polyline--polygon-edges).

| Value          | Behavior                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `"midpoint"`   | Fixed handle at the exact midpoint of each segment (default, matches pre-existing behavior)   |
| `"anyPoint"`   | Ghost handle follows the cursor along the hovered edge; click inserts the vertex at that point |

```tsx
// Default — split handles only at segment midpoints
<AnnotationCanvas edgeSplitMode="midpoint" ... />

// Split from any point along an edge
<AnnotationCanvas edgeSplitMode="anyPoint" ... />
```

---

### `polygonMinVertexAction` prop

```typescript
polygonMinVertexAction?: "block" | "polyline" | "line"; // default: "block"
```

Deleting vertices (alt-click or right-click a vertex handle) walks a polygon down toward its floor of three. This prop decides what the *third* deletion does.

| Value          | Behavior                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| `"block"`      | Deletion is refused; a polygon never drops below 3 vertices (default, matches pre-existing behavior) |
| `"polyline"`   | The polygon degrades to an open 2-point `polyline`                              |
| `"line"`       | The polygon degrades to a `line`                                                |

```tsx
// Default — polygons are locked at 3 vertices
<AnnotationCanvas polygonMinVertexAction="block" ... />

// Let a triangle collapse into an open path
<AnnotationCanvas polygonMinVertexAction="polyline" ... />
```

Notes:

- The degraded annotation keeps its `id`, `label`, `confidence`, `source`, and `meta`. Only `type` and `points` change, so consumers see a normal `UPDATE` through `onChange`, not a delete-plus-create.
- Since the shape is no longer closed, `measure.area()` returns `0` for it afterwards and `measure.perimeter()` becomes its open path length. It also drops out of the boolean shape ops and the label panel's area readout.
- **Compound polygons always block**, whatever the setting. Hollow shapes and boolean-op results carry `meta.rings`; there is no open-path form that preserves them, so their holes would be orphaned.
- Open shapes are unaffected — `line` and `polyline` still stop at 2 points.

---

### Label selector popover

Appears after completing a draw gesture (or when relabeling). Supports:

- Typing to search/filter labels
- Arrow keys to navigate
- `Enter` to select, `Escape` to cancel (discards the annotation)
- If only one label exists and it has no `symbolSize` config, it is auto-selected — no popover shown
- If the typed name doesn't match any label, a **Create "..."** row appears — only when `onLabelsChange` is wired, and never in `readonly` mode. A class minted here lives in the canvas's own state until that callback carries it out, so a consumer that is not listening is not offered one (2.0.1)
- When the selected label has `symbolSize: "optional" | "required"`, a second step collects **Attribute**, **Value**, and **Unit** (see [Symbol size](#symbol-size-manual-takeoff-dimensions))
- A **Keep for next shapes** checkbox pins the label being picked, so following shapes skip the popover entirely — only when `enableActiveLabel` is on (see [Pinned annotation class](#pinned-annotation-class))

---

## Pinned annotation class

Drawing 40 doors should not mean answering 40 popovers. Pin a class and every shape drawn afterwards is committed with that label immediately — no popover, no extra click.

The whole feature sits behind `enableActiveLabel`. Set it to `false` and the canvas behaves exactly as it always has — the label popover opens for every shape:

```tsx
// Classic behaviour — ask for a label every time
<AnnotationCanvas enableActiveLabel={false} ... />
```

That switch removes the chip, the `1`–`9` / `0` hotkeys, the popover's "Keep for next shapes" checkbox, and promptless committing. `activeLabel` / `defaultActiveLabel` are ignored while it is off.

### Pinning a class

Three ways, all equivalent:

- **Class chip** — the floating `CLASS [● Door ▾]` control at the top-left of the canvas. Click it to open the label picker; click ✕ to unpin.
- **Popover checkbox** — tick **Keep for next shapes** while labelling any drawn shape. That label stays pinned from then on.
- **Keyboard** — `1`–`9` pin the nth label in the `labels` registry, `0` unpins.

Pinning also switches to the label's `defaultTool` when that tool is present in the `tools` subset — pinning "Door" (`defaultTool: "bbox"`) puts you in bbox mode.

`Escape` does **not** unpin. It cancels the shape in progress and returns to the select tool, as before.

### Props

```typescript
enableActiveLabel?: boolean;                        // master switch; default: true
activeLabel?: string | null;                        // controlled — canonicalClassId or null
defaultActiveLabel?: string;                        // initial pin when uncontrolled
onActiveLabelChange?: (id: string | null) => void;  // fires on chip, checkbox, or hotkey
showActiveLabelBar?: boolean;                       // chip only; default: true
```

`enableActiveLabel` turns the feature on or off. `showActiveLabelBar` only hides the chip, keeping the hotkeys and the popover checkbox — use it when you render your own pinned-class control:

| `enableActiveLabel` | `showActiveLabelBar` | Result                                              |
| ------------------- | -------------------- | --------------------------------------------------- |
| `true` (default)    | `true` (default)     | Full feature with the built-in chip                 |
| `true`              | `false`              | Feature on, no chip — drive it via `activeLabel`    |
| `false`             | *(ignored)*          | Classic behaviour: label popover on every shape     |

Leave `activeLabel` out and the component owns the state. Pass it to drive the pin from your own UI:

```tsx
// Uncontrolled — open pinned to "door"
<AnnotationCanvas defaultActiveLabel="door" ... />

// Controlled — your app owns the pinned class
const [pinned, setPinned] = useState<string | null>(null);

<AnnotationCanvas
  activeLabel={pinned}
  onActiveLabelChange={setPinned}
  showActiveLabelBar={false}   // hide the built-in chip, render your own
  ...
/>
```

### Behavior notes

- **A pinned class overrides `onPendingShapeCommit`.** Consumers with a custom label popover get promptless drawing too — the callback is not invoked while a class is pinned.
- **Labels requiring a symbol size stay safe.** If the pinned label has `symbolSize: "required"` and no size was captured when it was pinned, the popover still opens for each shape. No annotation is ever committed without its required dimension. Pin the class through the chip (which collects the size once) to get promptless drawing for those labels.
- Pinning has no effect in `readonly` mode, and the chip is hidden.
- The pin starts empty unless you pass `defaultActiveLabel` — leaving `enableActiveLabel` at its default is behaviour-compatible for existing consumers until a user pins something.
- Relabeling an existing annotation always opens the popover — the pin only applies to newly drawn shapes.

---

## Comments

*Added in 2.0.0.* Off by default — a 1.x consumer that does not opt in sees no
change. Set `enableComments` and the canvas grows a comment tool, an in-canvas box
for writing one, and two cues on the drawing.

**The package never sees comment content.** It knows a thread exists, where it is
pinned, and how many comments it holds — enough to draw a marker and tell you
which thread was clicked. Bodies, authors, timestamps, replying, resolving and
persistence are yours, in your own panel. This is the same boundary the adapter
rule draws.

### Props

| Prop                | Type                                                    | Notes                                                                 |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `enableComments`    | `boolean`                                                | Master switch. **Default `false`** — off, nothing renders at all.      |
| `comments`          | `CommentAnchor[]`                                        | Display-only and controlled. The canvas never mutates it.             |
| `onCommentCreate`   | `(draft: CommentDraft) => void \| Promise<unknown>`      | The user wrote a comment. `draft.text` is what they typed.            |
| `onCommentSelect`   | `(id: string \| null, screenPos?: {x,y}) => void`        | A marker was clicked. `screenPos` anchors your thread popover.        |
| `onCommentDelete`   | `(id: string) => void`                                   | Thread id, not message id. Wiring this makes deletion appear on markers. |
| `onCommentUndo`     | `(op: CommentUndoOp) => void`                            | Apply an undo/redo step. Requires you to soft-delete.                 |
| `selectedCommentId` | `string \| null`                                         | Controlled highlight; omit to let the canvas own it.                  |

### Types

```typescript
type CommentTarget =
  | { kind: "point"; at: [number, number] }        // free-form, image px
  | { kind: "annotation"; annotationId: string };  // attached, moves with the shape

interface CommentAnchor {
  id: string;              // your thread id
  target: CommentTarget;
  count?: number;          // rendered inside the marker when > 1
  resolved?: boolean;      // dimmed, still clickable
  meta?: Record<string, unknown>;
}

interface CommentDraft {
  id: string;              // provisional id — adopt it or use your own
  target: CommentTarget;
  text: string;            // what the user typed. Never empty.
  screenPos: { x: number; y: number };
}
```

### Three ways to start a thread

| Route                                     | Result                          |
| ----------------------------------------- | ------------------------------- |
| Comment tool → click blank paper          | Free-form thread at that point  |
| Comment tool → click a shape              | Thread attached to that shape   |
| Select a shape → **Comment** on the ops bar | Thread attached to that shape |
| Select a shape → press `M`                | Thread attached to that shape   |

With the comment tool active, what is under the cursor decides which you get. The
selection-bar button exists so attaching is not hotkey-only.

### The two cues

Both cues are the same speech-bubble glyph as the toolbar's comment tool, drawn in
a loud red outline over an opaque fill so they stay legible over dense linework.
Position is what tells them apart: a free-form thread rests its tail on the point
it marks, an attached thread is centred on its shape's top-right corner.

Both are drawn at a constant **screen** size, so they do not grow with zoom, and
unlike label chips they are **never hidden at low zoom** — the marker is the only
signal a thread exists, and zoomed out is when you are hunting for one.

The colour comes from the `danger` theme token (resolved threads use
`textSecondary`), so overriding `danger` rethemes the markers. No new theme key
was added.

### Wiring it up

```tsx
const [threads, setThreads] = useState<Thread[]>([]);
const [openId, setOpenId] = useState<string | null>(null);

// Markers: id + position + count. No bodies.
const comments = useMemo(
  () => threads.map((t) => ({
    id: t.id, target: t.target, count: t.messages.length, resolved: t.resolved,
  })),
  [threads],
);

<AnnotationCanvas
  enableComments
  comments={comments}
  selectedCommentId={openId}
  onCommentCreate={(draft) => {
    // The canvas already collected the text — this is just "store it".
    setThreads((prev) => [...prev, {
      id: draft.id, target: draft.target, resolved: false,
      messages: [{ author: me, text: draft.text, at: Date.now() }],
    }]);
    setOpenId(draft.id);
  }}
  onCommentSelect={setOpenId}
  onCommentDelete={(id) => setThreads((p) => p.filter((t) => t.id !== id))}
  // Already yours since 1.3.0 — this is the "which shape is in focus" channel.
  onSelectionChange={setFocusedIds}
  ...
/>
```

`harness/app/CommentSidebar.tsx` is a working reference panel — read it, copy the
pattern, throw the styling away.

### Loading the thread for the shape in focus

There is no new prop for this. `onSelectionChange` already reports what is
selected on the canvas; filter your threads by those annotation ids.

### Deleting

`onCommentDelete` receives a **thread** id, never a message id. One click on a
marker's `x` removes the whole thread — twelve comments or one — so nobody has to
clear a conversation out a message at a time. Per-message deletion, if you want
it, is yours to build in your panel; the canvas has no concept of a message.

Markers gain that hover `x` and answer the `Delete` key **only when
`onCommentDelete` is wired**. Leave it off and they are read-only cues. Free-form
pins are fixed once placed — to move one, delete it and place another.

### Undo and redo

Comment operations share the annotation undo stack, so `Ctrl+Z` walks back what
the user did in the order they did it, across both kinds. The canvas cannot
restore a thread on its own — it never held the content — so it hands you an
intent and you apply it:

```tsx
onCommentUndo={(op) => {
  // "restore" -> put the thread back.  "remove" -> take it away again.
  setDeleted(op.id, op.action === "remove");
}}
```

`op` is a `CommentUndoOp`: `{ action, id, anchor? }`. `anchor` is the marker as
the canvas last knew it — enough to redraw the pin, never enough to rebuild the
conversation.

**This requires soft-delete.** Tombstone a removed thread instead of dropping it,
so `restore` can bring the messages back:

```tsx
const setDeleted = (id: string, deleted: boolean) =>
  setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, deleted } : t)));

const comments = useMemo(
  () => threads.filter((t) => !t.deleted).map(toAnchor),
  [threads],
);
```

Leaving `onCommentUndo` unwired is safe: comment steps still occupy the stack, so
the keystroke is consumed and nothing happens, rather than silently reverting an
unrelated annotation edit.

**Only canvas-initiated operations enter this history** — the marker's `x`, the
`Delete` key, and threads created through the comment box. A delete the user
performs in your own panel is your action and the canvas cannot see it, so offer
undo for that yourself.

### The draft marker

A provisional marker appears the moment the user clicks, before anything is
stored. It retires when your `comments` array changes identity, when
`onCommentCreate` returns a promise that settles, on Escape, or on a tool change.

### `readonly`

`readonly` means the drawing cannot be edited. Leaving a note is not an edit — and
a view-only review is the main place someone leaves one — so the comment tool,
the comment box and the selection bar's **Comment** button all stay live under
`readonly`, while every mutating control stays hidden. Gate commenting with
`enableComments` and the `tools` list, not with `readonly`.

### What does not change

Comments never enter `onChange` or `onSave`. The annotation payload is unaffected.

---

## Label panel (right sidebar)

Shows all annotations grouped by label. Features:

- Click an annotation row to select it on canvas (auto-pans if out of view)
- **Selecting an annotation on canvas auto-scrolls the panel to that row and highlights it** — collapsed groups are automatically expanded
- Click a group header to collapse/expand
- **Collapse all** — the chevron button in the panel header folds every class group at once (including the unknown-label bucket), and expands them all again when everything is already collapsed. Useful on drawings with many classes: collapse everything, then open just the class you're reviewing. Selecting an annotation on canvas still auto-expands its group.
- **Class visibility filter** — each group header has an eye toggle to hide/show that class's annotations on the canvas; a master eye toggle in the panel header hides or shows all classes at once. Hide everything, then click one class to review it in isolation. Hidden classes dim in the list and their shapes become non-selectable (excluded from clicks, marquee drag-select, and select-all). Visibility is a view-only state and never mutates annotation data.
- Hover a row to reveal relabel (✎) and delete (✕) actions
- Each annotation shows an `H` badge (human-created) or `AI` badge (engine output)
- When `meta.symbolSize` is set, the row shows the manual dimension (e.g. `diameter - 12mm`)
- When `dpi` and `drawingScale` are set, each row also shows the computed real-world size below the annotation ID (e.g. `4.25m` for a line, `0.90m×2.10m · 1.89m²` for a bbox, `14.2m²` for a polygon, `⌀0.60m · 0.28m²` for a circle)
- Bounded shapes (bbox, polygon, circle) also show their perimeter on a `P` line beneath the size (e.g. `P 6.20m`). Read the same numbers programmatically with [`measure`](#measure--area--perimeter-readout).

### Hiding the panel — `showAnnotationsPanel`

```tsx
<AnnotationCanvas showAnnotationsPanel={false} ... />
```

Defaults to `true`. When `false` the panel is not rendered at all and the canvas
takes the full width of its container — no reserved gutter, no empty column. Use
it when the list has nothing to add: a single label class, or your own richer
list rendered beside the canvas.

What stays available with the panel hidden:

| Action                | Without the panel                                                             |
| --------------------- | ----------------------------------------------------------------------------- |
| Select a shape        | Click it on the canvas; shift/⌘-click to add; drag a marquee for many          |
| Select all            | `Ctrl/Cmd+A`                                                                  |
| Delete                | `Delete` / `Backspace` on the selection                                       |
| Relabel               | `R` with exactly one shape selected — opens the same label popover            |
| Class visibility      | Not available — the eye toggles live in the panel. Any classes hidden while the panel was visible are shown again, so nothing can be stranded off-screen with no control to bring it back. |

`onChange` and `onSave` payloads are **identical** either way. The panel is a view
over the same reducer state that the canvas draws from; it holds no annotation
data of its own, and hiding it changes no annotation, no field, and no ordering.
The only state it owns is view-local (group collapse, class visibility, row
hover), none of which reaches the canonical output.

> **Accessibility:** hiding the panel takes away no keyboard access, because the
> panel never provided any. Its rows are click-only (`div` with `onClick`, no
> `tabIndex`), and the per-row relabel/delete buttons only mount on mouse hover,
> so they are not tab-reachable either. Reaching a *specific* shape by keyboard
> is not supported today with or without the panel — the keyboard paths to a
> selection are `Ctrl/Cmd+A`, then `Delete` or `R` to act on it. Shape-level
> keyboard navigation is a separate gap, tracked independently of this prop.

---

## State management

All state lives inside `AnnotationCanvas`. No external store required.

- `onSave` fires only when the user explicitly saves (`Ctrl+S` or a Save button you add externally)
- `onChange` fires after every mutation (add, update, delete, move)
- `onLabelsChange` fires when the user creates a new label via the popover, and its presence is what enables creating one: omit it and the popovers pick from `labels` only

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

Selected annotations show resize handles (bboxes: 8 handles at corners + edge midpoints; polygons: handles at every vertex + every edge; lines/polylines: handles at endpoints + every segment; circles: 4 cardinal handles — dragging any handle adjusts the radius while keeping the circle perfectly round).

### Splitting line / polyline / polygon edges

When a `line`, `polyline`, or `polygon` is selected, an accent-colored handle appears on each edge, letting you insert a new vertex mid-edge to reshape the annotation without redrawing it. Splitting a `line` (two endpoints) promotes it to `polyline` in the output. Polygon edges wrap around (the last point connects back to the first), so every edge — including the closing one — is splittable.

Where the split point lands on the edge is controlled by the `edgeSplitMode` prop:

- `"midpoint"` (default) — a fixed handle sits at the exact midpoint of each segment. Clicking it inserts the vertex there.
- `"anyPoint"` — hover anywhere along an edge and a ghost handle follows your cursor, snapped to the nearest point on that segment. Click to insert the vertex exactly where you're hovering.

```tsx
<AnnotationCanvas edgeSplitMode="anyPoint" ... />
```

Vertex handles always render above edge-split handles, so dragging an existing vertex near an edge never gets misread as a split.

### Deleting a vertex

When a `polygon`, `polyline`, or `line` is selected, **right-click** or **Alt+click** any vertex handle to delete it — the two edges that met there collapse into one new edge between the neighbouring vertices. Minimums are enforced: a polygon never drops below 3 vertices and a polyline never below 2 (a `line` has exactly two endpoints, so its vertices can't be deleted).

Deleting a **corner of a bbox** converts the rectangle to a `polygon` of the three remaining corners (a triangle), since a rectangle has no valid three-corner form. Vertex deletion is a single, undoable step and fires `onChange`.

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

### Area measurement (bounded shapes)

Every bounded annotation — **bbox, polygon, and circle** — also displays its enclosed real-world area, derived from the same DPI + scale calibration:

```
real area = pixel area × (real units per pixel)²
```

- **BBox** — shown as `length×width · area` (e.g. `10.0ft×4.0ft · 40.0ft²`)
- **Circle** — shown as `⌀diameter · area`, computed exactly as π·r²
- **Polygon** — area via the shoelace formula over its vertices
- **Compound shapes** (created with *Cut hole*) subtract hole areas from the outer ring, so a donut reports its true net area
- Units auto-promote for readability: `mm² → m²` (≥ 1,000,000), `cm² → m²` (≥ 10,000), `in² → ft²` (≥ 144)

Areas appear in the annotation chips, the label panel rows, and the status-bar readout for the selected annotation.

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

- **Annotation chips** show real-world dimensions next to the label. Bounded shapes (bbox, polygon, circle) also include their enclosed **area**:
  - BBox: `Door  92%  0.90m×2.10m · 1.89m²` (length × width · area)
  - Circle: `Column  ⌀0.60m · 0.28m²` (diameter · area)
  - Polygon: `Room  14.2m²` (area)
  - Line / polyline: `Wall  4.25m` (length)
- **Status bar** shows the active scale and DPI: `Scale: 1:100 · 300 DPI`
- **Status bar** also shows the full measurement of the currently selected annotation (when exactly one is selected) — visible at **any zoom level**, even when label chips are hidden by the zoom threshold or `labelVisibility` setting
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
export type { CommentAnchor, CommentDraft, CommentTarget }; // comment anchor types
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
