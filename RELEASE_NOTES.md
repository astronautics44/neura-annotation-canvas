# Neura Annotation Canvas — Release Notes

## v2.0.0

- **Comments on the canvas, off by default** — `enableComments` defaults to `false`. Off means no comment tool, no `M` binding and nothing rendered, so every 1.x app keeps working untouched.
- **The package never holds comment content** — it knows a thread exists, where it's pinned and how long it is. Bodies, authors, replying, resolving and persistence stay in your app.
- **Two cues, three ways in** — a red speech bubble, tail on the point for a free-form thread, on the shape's top-right corner when attached. Start one with the comment tool (blank paper vs. a shape), the **Comment** button on the selection bar, or `M`. Cues hold their size at every zoom and are never hidden.
- **Delete removes the whole thread** — `onCommentDelete` takes a thread id, never a message id. One click on a marker's `×` clears a twelve-comment conversation.
- **Undo/redo covers comments** — comment steps share the annotation history, so `Ctrl+Z` walks back what the user did in order. The canvas can't restore content it never held, so it hands you an intent via `onCommentUndo`. Requires you to soft-delete, so `restore` returns the conversation and not just the marker.
- **Fixed: comment operations no longer fall through to the annotation stack** — deleting a comment and pressing `Ctrl+Z` used to silently revert an unrelated annotation edit.
- **Commenting works under `readonly`** — leaving a note isn't an edit to the drawing. Gate it with `enableComments` and the `tools` list, not with `readonly`.
- **Payloads and `ThemeVars` unchanged** — comments never enter `onChange` or `onSave`; markers reuse the `danger` token rather than adding a theme key.
- **Breaking: `ToolType` gains `"comment"`** — passing `tools` is unaffected. Only an exhaustive `switch` or `Record<ToolType, …>` over the union needs a new arm.
- **Releases run off a version tag on main** — `git push origin v2.0.0` is the whole release. The tag is the source of truth and is stamped into `package.json` before the build.

@Dev @CV-Engineer

## v1.3.0

- **Selection is controllable** — `selectedIds` and `onSelectionChange`, the same shape `activeLabel` already has. Omit `selectedIds` and the canvas owns selection exactly as before. Echoing the callback straight back into the prop doesn't loop.
- **`revealSelection` pans an off-screen selection into view** — however the selection changed, including through `selectedIds`. A shape already on screen is left alone and zoom is never touched. Defaults to `false`.
- **Fixed: a click on a shape now selects it under `readonly`** — marquee, click-to-clear, `Ctrl+A` and panel rows already worked there; the obvious one didn't.
- **No breaking change** — additive props only.

@Dev @CV-Engineer

## v1.2.0

- **Selecting from the list raises the annotation to the top** — clicking a row now draws that shape above everything it overlaps, so picking one out of a dense stack no longer leaves it buried. Canvas clicks are unchanged; whatever you click there is already topmost.
- **Array order is the z-order, so `onChange` now fires on list-row clicks** — same annotations, different order, no field or id changes. Key off ids, not array position.
- **No undo step** — selecting a shape doesn't consume undo history.
- **Fixed: suppressed under `readonly`** — a view-only embed no longer emits `onChange` when you click a row.
- **No API change** — no prop or export added or altered.

@Dev @CV-Engineer

## v1.1.0

- **`showAnnotationsPanel` hides the list** — the canvas then takes the full container width, with no reserved gutter. Defaults to `true`. For consumers who render their own list.
- **Payloads are identical whether the panel shows or hides** — it's a read-only view over the same state and holds no annotation data of its own.
- **The per-class visibility filter is not applied when the panel is hidden** — so flipping it off mid-session can't strand hidden shapes with no control left to bring them back.
- **`annotations` is initial state, not a controlled prop** — it re-seeds whenever the array's identity changes, discarding in-progress edits and undo history. Build it once with `useMemo` and remount with `key` when the stored set genuinely changes.

@Dev @CV-Engineer
