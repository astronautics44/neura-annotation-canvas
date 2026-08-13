# Changelog

All notable changes to `@astronautics44/neura-annotation-canvas`.

## 1.3.0

### Added

- **`selectedIds?: string[]`** and **`onSelectionChange?: (ids: string[]) => void`**
  — selection becomes controllable, in the same controlled-with-callback shape
  `activeLabel` / `onActiveLabelChange` already has. Omit `selectedIds` entirely
  and the component owns selection exactly as it always has, so this is additive
  and changes nothing for existing consumers.

  It exists because a consumer that renders its own list beside the canvas
  (`showAnnotationsPanel: false`, added in 1.1.0) had no way to link the two: a
  click on their row could not mark the shape, and a click on the shape could not
  scroll their row into view. Faking it by remounting with a different label
  colour was the only option, and a remount resets zoom and pan — which on a
  legend strip is exactly the state the user had just set up.

  ```tsx
  const [selected, setSelected] = useState<string[]>([]);
  <AnnotationCanvas selectedIds={selected} onSelectionChange={setSelected} ... />
  ```

  `onSelectionChange` never fires for a change that arrived through
  `selectedIds`, and never fires with a set equal to the current one, so echoing
  it straight back into the prop does not loop.

- **`revealSelection?: boolean`** — pans to centre the selection when it is off
  screen, however the selection changed, including through `selectedIds`. That
  is what makes "click a row in my own list, show me its shape" work rather than
  marking a shape the user cannot see.

  A shape already on screen is left where it is, because panning under somebody
  who can already see what they clicked is disorienting and over a thirty row
  list it would mean the picture jumping on every click. Zoom is never touched.
  Defaults to `false`.

  The built-in annotations panel now routes its own centre-on-select through the
  same helper, so the internal list and a consumer's list behave identically.

### Fixed

- **A click on a shape now selects it under `readonly`.** Every other way of
  selecting already worked there — marquee drag, click on empty space to clear,
  Ctrl+A, and a click on a row of the annotations panel — so a view-only embed
  had a selection reachable four ways and not the obvious one. Selecting mutates
  nothing; dragging and deleting keep their own `readonly` guards.

  Consumers rendering `readonly` will now see the selection outline appear on a
  shape click where previously nothing happened.

---

## 1.2.0

### Changed

- **Selecting an annotation from the list raises it to the top of the z-order.**
  Clicking a row in the annotations panel now moves that annotation to the end
  of the array, so it draws above everything it overlaps. Picking a shape out of
  a dense stack from the list no longer leaves it buried under its neighbours.

  New internal reducer action `BRING_TO_TOP`. Canvas clicks are unaffected —
  whatever you click there is already the topmost hit.

### Payload note

Array order **is** part of the `onChange` / `onSave` payload — it is the z-order.
So a list-row click now emits an `onChange` with the same annotations in a
different order. No annotation, field or id changes. Consumers that key off ids
see nothing new; consumers that depend on array position should read the order
from the payload rather than assuming it is stable across selections.

The reorder deliberately does **not** take an undo snapshot — selecting a shape
should not consume an undo step.

### Fixed

- The reorder is suppressed under `readonly`. Array order is part of the payload,
  so raising a shape is a mutation, and `readonly` means no mutations — a
  view-only embed no longer emits `onChange` when the user clicks a list row.

---

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
