# Changelog

All notable changes to `@astronautics44/neura-annotation-canvas`.

## 1.1.0

### Added

- **`showAnnotationsPanel?: boolean`** — hides the annotations list panel beside
  the canvas. Defaults to `true`, so no existing consumer changes behaviour.

  When `false` the panel is not rendered at all and the canvas takes the **full
  width of its container** — no reserved gutter, no empty column. On a full
  architectural sheet in a constrained viewport this is the difference between
  drawing at ~20% zoom and drawing at a size a box can actually be placed
  accurately at.

  ```tsx
  <AnnotationCanvas showAnnotationsPanel={false} tools={["select", "bbox"]} ... />
  ```

  Intended for consumers who render their own list — a single label class makes
  the built-in rows (`#9a4XReH · bbox`) an id and a geometry type and nothing
  more.

### Payload guarantee

**`onChange` and `onSave` emit byte-identical payloads whether the panel is shown
or hidden.** This is not a promise about the current implementation being
careful — it is structural. The panel is a read-only view over the same
`useReducer` state the canvas draws from; it holds no annotation data of its own.
Nothing about hiding it touches an annotation, a field, or the array ordering.
The only state the panel owns is view-local (group collapse, class visibility,
row hover), and none of it is part of the canonical output. Building a region set
from `onChange` is safe with the panel hidden.

### Behaviour when the panel is hidden

Everything below works on the canvas and does not depend on the panel:

| Action           | Path                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Select a shape   | Click it on the canvas; shift/⌘-click to add; drag a marquee for many |
| Select all       | `Ctrl/Cmd+A`                                                        |
| Delete           | `Delete` / `Backspace` on the selection                             |
| Relabel          | `R` with exactly one shape selected                                 |
| Zoom / pan / fit | Unchanged                                                           |

The one thing that is only in the panel is the per-class visibility filter (the
eye toggles). With the panel hidden the class filter is **not applied**, so a
consumer that flips `showAnnotationsPanel` to `false` mid-session cannot strand
hidden shapes with no control left to bring them back.

### Accessibility note

Hiding the panel removes **no** keyboard access, because the panel never provided
any. Its rows are click-only (`div` with `onClick`, no `tabIndex`, no key
handler), and the per-row relabel/delete buttons mount only on mouse hover, so
they are not tab-reachable either.

Reaching a *specific* shape by keyboard is not supported today — with or without
the panel. The keyboard paths to a selection are `Ctrl/Cmd+A`, then `Delete` or
`R` to act on it. Shape-level keyboard navigation is a real gap, but it is a
pre-existing one that this prop neither creates nor worsens. Flagged here rather
than fixed silently; it belongs in its own change.

### Documentation

- **`annotations` is initial state, not a controlled prop** — now documented
  explicitly in the README. The prop seeds internal state on mount and re-seeds
  whenever the array's **identity** changes, which discards in-progress edits and
  undo history.

  The canvas skips the re-seed when the incoming array is the exact array it last
  emitted through `onChange` (so feeding `onChange` output back in is safe), but
  it cannot skip a new array built during render. Passing a freshly built array
  each render loops: re-seed → `onChange` → parent `setState` → render → new
  array identity → re-seed, until React throws "Maximum update depth exceeded".

  Build the array once (`useMemo`) and remount with `key` when the stored set
  genuinely changes. Also documented: `onChange` fires once on mount with the
  seeded array, before the user has touched anything.

---

## 1.0.2 and earlier

Released before this changelog was kept. See the
[GitHub releases](https://github.com/astronautics44/neura-annotation-canvas/releases).
