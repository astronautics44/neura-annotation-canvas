# Installing and Using the Annotation Canvas

This guide is for a developer who wants to use `@astronautics44/neura-annotation-canvas` inside their own React or Next.js app.

## 1. Get Package Access

The package is published to GitHub Packages under the `@astronautics44` scope. Because it is private, your app needs a token that can read packages.

Create or update `.npmrc` in your app:

```ini
@astronautics44:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

The `.npmrc` file reads the token from an environment variable named `NODE_AUTH_TOKEN`. That token should come from the app's environment, not from a hardcoded value in `.npmrc`.

For local development, create a GitHub token with `read:packages` access:

1. Open GitHub in your browser.
2. Go to **Settings** -> **Developer settings** -> **Personal access tokens**.
3. Create a token that has `read:packages` access.
4. Copy the token. It will look similar to `ghp_...`.
5. In your terminal, inside your app repo, export it:

```bash
export NODE_AUTH_TOKEN=ghp_your_token_here
```

This only sets the token for the current terminal session. If you close the terminal, you may need to export it again before running `npm install`.

For production or CI, do not use the terminal `export` step. Instead, add `NODE_AUTH_TOKEN` as a secret/environment variable in the platform that builds the app, such as GitHub Actions, Vercel, Netlify, Render, Railway, or your Docker build environment. When that platform runs `npm install` or `npm ci`, npm reads `.npmrc`, finds `${NODE_AUTH_TOKEN}`, and uses the token from the app's build environment.

To confirm the token is available in your terminal:

```bash
echo $NODE_AUTH_TOKEN
```

It should print your token. If it prints nothing, export the token again.

Never commit a real token to git.

## 2. Install the Package

```bash
npm install @astronautics44/neura-annotation-canvas
```

The package requires React and React DOM in your app:

```bash
npm install react react-dom
```

You do not need to install Konva separately. The canvas package brings its own canvas dependencies.

### Updating an Existing Install

If your app already uses an older version of the package, update to the latest released version:

```bash
npm install @astronautics44/neura-annotation-canvas@0.1.7
```

Then restart your app or dev server.

If your project has a lockfile, such as `package-lock.json`, commit the updated lockfile after running the install command.

### AWS EC2 Setup

If your app is deployed on an AWS EC2 instance, npm still needs access to GitHub Packages during install/build.

The token is only needed on the EC2 server while running `npm install` or `npm ci`. The running Next.js app does not need the token in browser/runtime code.

Recommended EC2 setup with Docker:

1. SSH into the EC2 instance:

```bash
ssh ubuntu@your-ec2-ip
```

2. Keep this `.npmrc` in the app repo:

```ini
@astronautics44:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

3. Pass `NODE_AUTH_TOKEN` only while building the Docker image.

Recommended, using Docker BuildKit secrets:

```bash
export NODE_AUTH_TOKEN=ghp_your_real_token_here

DOCKER_BUILDKIT=1 docker build \
  --secret id=npm_token,env=NODE_AUTH_TOKEN \
  -t your-nextjs-app .
```

4. In your `Dockerfile`, make the token available only for the install step:

```dockerfile
COPY .npmrc .npmrc
COPY package*.json ./
RUN --mount=type=secret,id=npm_token \
  NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" npm ci

# Remove npm auth before copying/running the rest of the app.
RUN rm -f .npmrc

COPY . .
RUN npm run build
```

5. Run the built image:

```bash
docker run -d --name your-nextjs-app -p 3000:3000 your-nextjs-app
```

Important: the token is needed to download the package while the Docker image is being built. The running container does not need the token unless you run `npm install` inside the running container.

Avoid baking the token into the final Docker image. Do not add `ENV NODE_AUTH_TOKEN=...` to the Dockerfile.

If your Docker setup cannot use BuildKit secrets, you can use a build arg instead:

```bash
docker build \
  --build-arg NODE_AUTH_TOKEN=ghp_your_real_token_here \
  -t your-nextjs-app .
```

Build arg Dockerfile install step:

```dockerfile
ARG NODE_AUTH_TOKEN
COPY .npmrc .npmrc
COPY package*.json ./
RUN npm ci
RUN rm -f .npmrc
```

Alternative EC2 setup without Docker:

Save the GitHub Packages auth in the server user's npm config:

```bash
npm config set @astronautics44:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken ghp_your_real_token_here
```

Then install/build on the server:

```bash
cd /path/to/your/nextjs-app
npm install
npm run build
```

Do not use `NEXT_PUBLIC_NODE_AUTH_TOKEN`. Anything starting with `NEXT_PUBLIC_` can be exposed to the browser.

## 3. Create Your Labels

Labels define what classes users can assign to annotations.

```typescript
// lib/annotation-labels.ts
import type { LabelMap } from "@astronautics44/neura-annotation-canvas";

export const labelRegistry: LabelMap[] = [
  {
    canonicalClassId: "door",
    displayName: "Door",
    color: "#FF6B6B",
    defaultTool: "bbox",
  },
  {
    canonicalClassId: "wall",
    displayName: "Wall",
    color: "#FFE66D",
    defaultTool: "polygon",
  },
  {
    canonicalClassId: "route",
    displayName: "Route",
    color: "#60A5FA",
    defaultTool: "polyline",
  },
  {
    canonicalClassId: "column",
    displayName: "Column",
    color: "#B8B8FF",
    defaultTool: "point",
  },
];
```

## 4. Convert Your Data to the Canonical Format

The package does not understand your CV engine's raw output. Your app must convert engine output into `CanonicalAnnotation[]` before passing it to the canvas.

Example:

```typescript
// lib/annotation-adapter.ts
import { geo } from "@astronautics44/neura-annotation-canvas";
import type { CanonicalAnnotation } from "@astronautics44/neura-annotation-canvas";

type EngineDetection = {
  id: string;
  className: string;
  bbox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
};

const labelMap: Record<string, string> = {
  DOOR: "door",
  WALL: "wall",
};

export function adaptEngineOutput(
  detections: EngineDetection[],
): CanonicalAnnotation[] {
  return detections.map((d) => ({
    id: d.id,
    type: "bbox",
    points: geo.cocoBoxToPoints(d.bbox),
    label: labelMap[d.className] ?? "unknown",
    confidence: d.confidence,
    source: "engine",
  }));
}
```

Important: adapters live in your app, not inside this package.

The package exports `geo` — pure coordinate math helpers for use in adapters (no schema knowledge):

```typescript
import { geo } from "@astronautics44/neura-annotation-canvas";

geo.cocoBoxToPoints([x, y, w, h]);           // COCO bbox → [[x1,y1],[x2,y2]]
geo.yoloBoxToPoints([cx, cy, w, h], imgW, imgH); // YOLO normalized → pixels
geo.quadToPoints([[x,y], ...]);               // 4-corner quad → axis-aligned bbox
geo.cocoSegToPoints([x1, y1, x2, y2, ...]);   // flat COCO seg → [[x,y],...]
```

## 5. Use It in a Next.js Page

In Next.js, import the component with `dynamic` and `ssr: false`.

```tsx
// app/review/page.tsx
"use client";

import dynamic from "next/dynamic";
import { labelRegistry } from "@/lib/annotation-labels";
import { adaptEngineOutput } from "@/lib/annotation-adapter";

const AnnotationCanvas = dynamic(
  () =>
    import("@astronautics44/neura-annotation-canvas").then(
      (m) => m.AnnotationCanvas,
    ),
  { ssr: false },
);

export default function ReviewPage() {
  const imageUrl = "/drawing.png";
  const engineOutput = [
    {
      id: "det-1",
      className: "DOOR",
      bbox: [120, 200, 80, 120] as [number, number, number, number],
      confidence: 0.94,
    },
  ];

  const annotations = adaptEngineOutput(engineOutput);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <AnnotationCanvas
        image={imageUrl}
        labels={labelRegistry}
        annotations={annotations}
        onSave={(updatedAnnotations) => {
          console.log("Save these annotations:", updatedAnnotations);
        }}
      />
    </div>
  );
}
```

The canvas fills **100% of its container**. Always give the wrapper an explicit height (`100vh`, a fixed pixel height, or `flex: 1` inside a flex/grid layout). If the container is too short, toolbar buttons at the bottom (line, point, circle) may be clipped because the toolbar does not scroll.

Konva touches `window` at import time. The `dynamic` import with `ssr: false` above is required in Next.js — do not import `AnnotationCanvas` directly at the top level of a server component.

## 6. Save User Changes

`onSave` runs when the user explicitly saves from the canvas, for example with `Ctrl/Cmd + S`.

```tsx
<AnnotationCanvas
  image={imageUrl}
  labels={labelRegistry}
  annotations={annotations}
  onSave={async (updatedAnnotations) => {
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedAnnotations),
    });
  }}
/>
```

Use `onChange` only if you need live updates after every edit:

```tsx
<AnnotationCanvas
  image={imageUrl}
  labels={labelRegistry}
  annotations={annotations}
  onChange={(latestAnnotations) => {
    // Optional autosave or local state update.
  }}
  onSave={(latestAnnotations) => {
    // Final explicit save.
  }}
/>
```

`onLabelsChange` fires when the user creates a new label from the label selector popover. Use it to persist an expanded label registry if your app supports user-defined classes.

## 7. Tools and Annotation Types

### Available tools

By default, the left toolbar shows **all** tools:

```typescript
type ToolType =
  | "select"
  | "bbox"
  | "polygon"
  | "polyline"
  | "line"
  | "point"
  | "circle";
```

| Tool     | Shortcut | What it draws        |
| -------- | -------- | -------------------- |
| Select   | `V`      | —                    |
| BBox     | `B`      | rectangle            |
| Polygon  | `P`      | closed polygon       |
| Polyline | `Y`      | open multi-segment line (`Enter` to finish) |
| Line     | `L`      | two-point segment    |
| Point    | `N`      | single marker        |
| Circle   | `C`      | click center, drag radius |

The toolbar also includes a **Hand** tool (`H`) for panning, plus **Undo** / **Redo** (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`).

If line, point, or circle are missing from your toolbar, check the two most common causes:

1. You passed a `tools` prop that omits them (see section 8).
2. The canvas container is too short and the bottom toolbar buttons are clipped. Give the canvas a full-height parent (see section 5).

### Annotation coordinate formats

Annotations always use **image pixel coordinates**, not screen coordinates.

```typescript
type AnnotationType =
  | "bbox"
  | "polygon"
  | "polyline"
  | "line"
  | "point"
  | "circle";
```

Point formats:

```typescript
// bbox
points: [[x1, y1], [x2, y2]]

// polygon (open — no duplicate closing point)
points: [[x, y], [x, y], [x, y]]

// polyline
points: [[x, y], [x, y], [x, y]]

// line
points: [[x1, y1], [x2, y2]]

// point
points: [[x, y]]

// circle (bounding box; center and radius are derived from the two corners)
points: [[x1, y1], [x2, y2]]
```

## 8. Limit the Visible Tools

By default, all seven tools are shown. Pass `tools` only when you want to hide some of them:

```tsx
// Hide circle, point, and line — only show bbox/polygon/polyline drawing tools
<AnnotationCanvas
  image={imageUrl}
  labels={labelRegistry}
  annotations={annotations}
  tools={["select", "bbox", "polygon", "polyline"]}
  onSave={handleSave}
/>
```

To show every tool, either omit `tools` entirely or pass the full list explicitly:

```tsx
<AnnotationCanvas
  tools={["select", "bbox", "polygon", "polyline", "line", "point", "circle"]}
  ...
/>
```

> **Note:** Keyboard shortcuts only activate tools that are in your `tools` array. If `line` is not listed, pressing `L` will not switch to the line tool.

## 9. Drawing Scale (Real-World Dimensions)

Drawing scale is **optional**. Without it, annotations work normally — you just will not see real-world sizes on annotation chips or a scale control in the status bar.

This is different from **zoom** (`Zoom: 100%` in the status bar). Zoom only changes how large the image appears on screen. Drawing scale converts pixel measurements into real-world units (mm, m, in, ft) for quantity takeoff.

### When the scale UI appears

The package shows `Scale: … · … DPI` in the status bar only when you pass at least one of:

- `dpi` — scanner resolution in dots per inch (e.g. `300`)
- `drawingScale` — the architectural scale of the drawing

If neither prop is set, no scale section is rendered.

The package does **not** include a preset scale dropdown (e.g. "1:100 @ 300 DPI"). That control exists only in the internal dev harness. If you want a dropdown, build it in your app and wire it to `dpi` and `drawingScale` props (see below).

### `DrawingScale` type

```typescript
import type { DrawingScale } from "@astronautics44/neura-annotation-canvas";

interface DrawingScale {
  value: number;                            // real units per 1 paper unit
  unit: "mm" | "cm" | "m" | "in" | "ft";  // real-world unit for display
  label: string;                            // shown in the status bar, e.g. "1:100"
}
```

### Common scale values

| Drawing convention | `value` | `unit` | `label`      |
| ------------------ | ------- | ------ | ------------ |
| 1:100 (metric)     | 100     | `"mm"` | `"1:100"`    |
| 1:50 (metric)      | 50      | `"mm"` | `"1:50"`     |
| 1:20 (metric)      | 20      | `"mm"` | `"1:20"`     |
| 1/4" = 1' (US)     | 48      | `"in"` | `'1/4"=1\''` |
| 1/8" = 1' (US)     | 96      | `"in"` | `'1/8"=1\''` |

For imperial scales, `value` is real inches per paper inch. For example, 1/4" = 1' means 0.25 paper inches = 12 real inches, so 1 paper inch = 48 real inches → `value: 48`.

### Basic usage

Pass scale data from your CV engine or backend. Persist corrections via `onDrawingScaleChange`:

```tsx
import type { DrawingScale } from "@astronautics44/neura-annotation-canvas";

const cvScale: DrawingScale = { value: 100, unit: "mm", label: "1:100" };

<AnnotationCanvas
  image={imageUrl}
  labels={labelRegistry}
  annotations={annotations}
  dpi={300}
  drawingScale={cvScale}
  onDrawingScaleChange={(updatedScale) => {
    // User corrected the scale in the status bar — save to your backend
    saveDrawingScale(drawingId, updatedScale);
  }}
  onSave={handleSave}
/>
```

### What users see

When both `dpi` and `drawingScale` are set:

- **Annotation chips** show real-world dimensions (e.g. `Door  0.90m × 2.10m`, `Wall  4.25m`)
- **Status bar** shows `Scale: 1:100 · 300 DPI`
- **Edit button (✎)** next to the scale opens an inline form to correct a wrong CV-extracted scale. `onDrawingScaleChange` fires when the user confirms.

In `readonly` mode, the edit button is hidden but the scale label still displays if props are provided.

### Optional: preset scale dropdown in your app

If you want a dropdown like the dev harness demo, keep preset state in your page and pass it into the canvas:

```tsx
const SCALE_PRESETS = [
  { label: "1:100 @ 300 DPI", dpi: 300, scale: { value: 100, unit: "mm" as const, label: "1:100" } },
  { label: "1:50 @ 300 DPI",  dpi: 300, scale: { value: 50,  unit: "mm" as const, label: "1:50"  } },
  { label: '1/4"=1\' @ 300 DPI', dpi: 300, scale: { value: 48, unit: "in" as const, label: '1/4"=1\'' } },
];

function ReviewPage() {
  const [presetIdx, setPresetIdx] = useState(0);
  const preset = SCALE_PRESETS[presetIdx]!;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <select value={presetIdx} onChange={(e) => setPresetIdx(Number(e.target.value))}>
        {SCALE_PRESETS.map((p, i) => (
          <option key={i} value={i}>{p.label}</option>
        ))}
      </select>
      <div style={{ flex: 1 }}>
        <AnnotationCanvas
          dpi={preset.dpi}
          drawingScale={preset.scale}
          onDrawingScaleChange={(s) => { /* persist */ }}
          ...
        />
      </div>
    </div>
  );
}
```

## 10. Read-Only Mode

Use `readonly` when users should view annotations but not edit them:

```tsx
<AnnotationCanvas
  image={imageUrl}
  labels={labelRegistry}
  annotations={annotations}
  readonly
  onSave={() => {}}
/>
```

In read-only mode, drawing tools are disabled, the scale edit button is hidden, and users cannot create or modify annotations. Zoom and pan still work.

## 11. Optional Feature Toggles

These props all default to `true`. Set any to `false` to hide UI chrome for a minimal embed:

```tsx
<AnnotationCanvas
  showZoomControls={true}   // zoom in/out/fit buttons in the status bar
  showUndoRedo={true}       // undo/redo buttons in the toolbar
  enableSelectAll={true}    // Ctrl/Cmd+A selects all annotations
  showFullscreen={true}     // fullscreen toggle in the status bar
  ...
/>
```

Example — view-only embed with minimal UI:

```tsx
<AnnotationCanvas
  readonly
  showZoomControls={false}
  showUndoRedo={false}
  enableSelectAll={false}
  tools={["select"]}
  onSave={() => {}}
  ...
/>
```

## 12. GitHub Actions Install Example

In a private consumer repo, configure package auth before `npm ci`:

```yaml
- uses: actions/setup-node@v4
  with:
    registry-url: https://npm.pkg.github.com
    scope: "@astronautics44"

- run: npm ci
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

If the package lives in a different private repo or org, use a secret token with `read:packages` access instead of `GITHUB_TOKEN`.

