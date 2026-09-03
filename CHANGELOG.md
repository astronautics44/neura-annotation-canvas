# Changelog

All notable changes to `@astronautics44/neura-annotation-canvas`.

## 2.0.1

A fix and two performance changes, all found on one screen: a takeoff review
carrying a hundred and forty marks, in `takeoff-client`.

### Fixed

- **"Create <name>" is offered only when `onLabelsChange` is wired.** The class
  it mints lives in the canvas's own state, under an id the canvas invented, and
  that callback is the only way it can leave. A consumer that did not listen
  never learned the class existed, could not save the marks filed under it, and
  lost both the moment `labels` was re-seeded — the marks fell to *Unknown label*
  with their work gone, while the consumer's own save reported success. Now the
  popovers and the panel offer creation only where its output can go somewhere.
  A consumer that wants canvas-minted classes wires `onLabelsChange`, which the
  harness already did; nothing else changes for it.

### Changed

- **The annotations panel no longer re-renders on every viewport change.**
  `scale` and `stagePos` are state on the canvas, so a wheel tick or a pan
  mousemove is a render of the whole component, and the panel — a row of DOM
  per annotation, none of which reads the viewport — was re-rendering every row
  with it, because its handlers were fresh closures on every render. It is
  `React.memo` now, the handlers it is given are stable, and the resolved theme
  and the dimension context are memoised so the memo holds. On the drawing that
  found this, that was the difference between a pan that follows the hand and
  one that moves in steps.

- **Wheel zoom follows the gesture rather than the event count.** A mouse notch
  is one event with a large `deltaY`; a trackpad pinch is dozens with small
  ones. Each used to apply a fixed ×1.1, so a pinch climbed a staircase. The
  step is now proportional to the delta, calibrated so a notch is still exactly
  ×1.1, clamped so a flung wheel cannot jump more than about a third in one
  event, and `deltaMode` is honoured. **`zoomSpeed`** (default `1`) scales the
  whole curve.

### Upgrading from 2.0.0

A patch by the product owner's call. `zoomSpeed` is a new optional prop, which semver would ordinarily make a minor; it is recorded here so nobody reads the number as a promise that the API did not grow.

No runtime change is required unless you were relying on the canvas minting
classes **without** listening to `onLabelsChange`. If you were, wire it — that
is a one-line change and the behaviour is then identical. Everything else is
additive: `zoomSpeed` is optional and defaults to the old notch step.

## 2.0.0

Commenting. A major version by choice — the feature is additive and every 1.x
consumer keeps working untouched (see **Upgrading from 1.3.0** at the end of this
entry for the one type-level caveat).

### Added

- **Commenting.** A comment tool, an in-canvas box to write one, and two cues on
  the drawing. Gated behind **`enableComments`, which defaults to `false`** — off,
  there is no tool button, no `M` binding, and nothing rendered, so a consumer
  that never adopts this behaves exactly as it did in 1.3.0.

  The split is the same one the adapter rule draws. The package knows a thread
  *exists*, where it is pinned and how long it is. It never sees a body, an
  author or a timestamp. Reading a thread, replying, resolving and persistence
  are the consumer's, in the consumer's own panel.

  ```tsx
  <AnnotationCanvas
    enableComments
    comments={anchors}                       // display-only: id, position, count
    onCommentCreate={(d) => store(d.text)}   // the canvas collected the text
    onCommentSelect={(id) => openThread(id)}
    onCommentDelete={(id) => remove(id)}
  />
  ```

- **Two anchor kinds.** `{ kind: "point", at: [x, y] }` pins a thread to a spot
  on the drawing; `{ kind: "annotation", annotationId }` pins it to a shape, and
  it moves with that shape. An anchor whose annotation is deleted or hidden by
  the class filter is skipped, not drawn at the origin.

- **Three ways in, so it is not hotkey-only.** With the comment tool active,
  clicking blank paper starts a free-form thread and clicking a shape attaches
  one — what is under the cursor decides which. With a shape selected, the
  **Comment** button on the selection bar and the `M` key both attach to it.

- **Cues sized in screen pixels, never hidden.** Both cues are the same
  speech-bubble glyph as the toolbar's comment tool, drawn in a loud red outline
  over an opaque fill — a construction sheet is dense grey linework, and a cue
  that blends into it is not a cue. Position tells them apart: a free-form thread
  rests its tail on the point it marks, an attached one is centred on its shape's
  top-right corner.

  Both stay the same size from 5% to 2000% zoom, and neither honours the 30%
  cutoff that hides label chips — the marker is the only signal a thread exists,
  and zoomed out is exactly when you are looking for one. The count shows when a
  thread has more than one comment; resolved threads dim and drop to the muted
  colour.

- **`onCommentDelete` is what makes deletion appear.** Wire it and markers gain a
  hover `x` and answer the `Delete` key; leave it off and they are read-only
  cues. Free-form pins are fixed once placed — repositioning is a delete and a
  re-place.

- **`selectedCommentId`** is controlled in the same shape as `selectedIds`; omit
  it and the canvas owns the highlight.

- **Undo and redo cover comments**, through one shared history. Creating or
  deleting a thread on the canvas takes a place in the same stack as annotation
  edits, so `Ctrl+Z` walks back the things the user actually did, in order,
  whichever kind each one was.

  The canvas cannot carry a comment step out itself — it never held the thread's
  content — so it hands you an intent through **`onCommentUndo`** and you apply
  it: `restore` puts a thread back, `remove` takes it away. They are exact
  inverses, so redo needs nothing extra.

  ```tsx
  onCommentUndo={(op) => setDeleted(op.id, op.action === "remove")}
  ```

  This asks one thing of you: **soft-delete**. Keep a tombstone of a removed
  thread so `restore` brings the conversation back and not just the marker.

  Leaving `onCommentUndo` unwired is safe and is not the old behaviour — comment
  steps still occupy the stack. The keystroke is consumed and nothing happens,
  rather than falling through to revert an unrelated annotation edit the user was
  not thinking about. That fall-through was the pre-1.4 behaviour of this stack
  and it was wrong.

  **Only canvas-initiated operations enter this history** — the marker's `x`, the
  `Delete` key, and a thread created through the comment box. A delete the user
  performs in *your* panel is your action, and the canvas cannot see it; offer
  undo for that yourself.

### Which annotation is in focus

There is no new prop for this. `onSelectionChange` (1.3.0) already reports what
is selected on the canvas, which is the signal to load that shape's thread into
your panel. The harness wires exactly that.

### Commenting works under `readonly`

`readonly` means the drawing cannot be edited. Leaving a note is not an edit, and
a view-only review is the main place someone leaves one — so the comment tool,
the comment box and the selection bar's **Comment** button all stay live there,
while every mutating control on that bar stays hidden. Availability is controlled
by `enableComments` and the `tools` list, not by `readonly`.

### Payloads are untouched

Comments never enter `onChange` or `onSave`. The annotation array is byte-identical
to what 1.3.0 emitted for the same edits.

### Upgrading from 1.3.0

**No runtime change is required.** Every new prop is optional, `enableComments`
defaults to `false`, and with it off the canvas renders and behaves exactly as
1.3.0 did — same toolbar, same bindings, same payloads. Bump the version and
ship; adopt commenting whenever you are ready.

The one thing to know is type-level: **`ToolType` gains `"comment"`**. Passing
`tools` is unaffected. The only code this can break is an exhaustive `switch` or
`Record<ToolType, …>` over the union in consumer code, which now needs a
`comment` arm or a default.

`ThemeVars` is deliberately **unchanged** — markers reuse `danger` for the open
outline and `textSecondary` for the resolved one, rather than adding a required
key that every full theme literal would then have to supply. Retheme the marker
colour by overriding `danger`.

---

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
