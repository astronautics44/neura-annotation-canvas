# Installing and Using the Annotation Canvas

This guide is for a developer who wants to use `@astronautics44/neura-annotation-canvas` inside their own React or Next.js app.

## 1. Get Package Access

The package is published to GitHub Packages under the `@astronautics44` scope. Because it is private, your app needs a token that can read packages.

Create or update `.npmrc` in your app:

```ini
@astronautics44:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

For local development, export a GitHub token with `read:packages` access:

```bash
export NODE_AUTH_TOKEN=ghp_your_token_here
```

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

## 7. Common Tool Types

Annotations use image pixel coordinates.

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

// polygon
points: [[x, y], [x, y], [x, y]]

// polyline
points: [[x, y], [x, y], [x, y]]

// line
points: [[x1, y1], [x2, y2]]

// point
points: [[x, y]]

// circle
points: [[x1, y1], [x2, y2]] // circle bounding box
```

## 8. Limit the Visible Tools

By default, all tools are shown. You can pass a smaller tool list:

```tsx
<AnnotationCanvas
  image={imageUrl}
  labels={labelRegistry}
  annotations={annotations}
  tools={["select", "bbox", "polygon", "polyline"]}
  onSave={handleSave}
/>
```

## 9. Read-Only Mode

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

## 10. GitHub Actions Install Example

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

