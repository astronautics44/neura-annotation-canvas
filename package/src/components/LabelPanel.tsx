"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { AnnotationGroup, CanonicalAnnotation, LabelMap, SymbolSize } from "../types/canonical";
import { LabelPopover } from "./LabelPopover";
import { formatSymbolSizeLabel, parseSymbolSize } from "../utils/symbolSize";
import { optionalMarks } from "./canvasHelpers";
import {
  formatAnnotationCalculatedSize,
  formatAnnotationPerimeter,
  type DrawingScaleInput,
} from "../utils/dimensions";

interface Props {
  annotations: CanonicalAnnotation[];
  labels: LabelMap[];
  selectedIds: string[];
  /** Label class ids currently hidden from the canvas. */
  hiddenClasses?: ReadonlySet<string>;
  /** Called with the next full set of hidden class ids when the user toggles visibility. */
  onVisibilityChange?: (next: Set<string>) => void;
  onSelect: (id: string, additive: boolean) => void;
  /**
   * Replace the selection outright with this exact set — a shift-click range,
   * or every row of one class. Without it the panel keeps its one-row-at-a-time
   * behaviour and shift falls back to toggling.
   */
  onSelectMany?: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onDeleteSelected?: () => void;
  onRelabel: (id: string, label: string, symbolSize?: SymbolSize) => void;
  /**
   * Move many annotations onto one class in a single step — the bulk relabel
   * behind the header button and the per-class "change class" action. Without
   * it those controls do not appear.
   */
  onRelabelMany?: (ids: string[], label: string, symbolSize?: SymbolSize) => void;
  onCreateLabel?: ((displayName: string) => string) | undefined;
  readonly?: boolean;
  width?: number;
  height?: number;
  /**
   * Start every class section and every annotation group collapsed, including
   * one that appears later. The chevrons, "collapse all" and selecting a shape
   * on the canvas still open them. Default: false
   */
  groupsCollapsed?: boolean;
  /**
   * The canvas's annotation groups, when grouping is on; undefined when it is
   * off, which hides every trace of groups. Not to be confused with the class
   * sections this panel calls groups internally.
   */
  annotationGroups?: AnnotationGroup[] | undefined;
  onGroupSelect?: ((groupId: string) => void) | undefined;
  onGroupRename?: ((groupId: string, name: string) => void) | undefined;
  onGroupRecolor?: ((groupId: string, color: string) => void) | undefined;
  onGroupDelete?: ((groupId: string) => void) | undefined;
  /**
   * Mark optional rows. Set when the canvas has `enableOptional`; without it
   * the panel shows nothing about optional marks.
   */
  showOptional?: boolean;
  /** Whether optional marks are hidden from the canvas by the Optional section's eye. */
  optionalHidden?: boolean;
  /** Hide or show every optional mark. Without it the Optional section has no eye. */
  onOptionalVisibilityChange?: ((hide: boolean) => void) | undefined;
  /** Select every optional mark. Without it the section's name selects nothing. */
  onOptionalSelect?: (() => void) | undefined;
  /** When both dpi and drawing scale are set, calculated sizes appear in the list. */
  dimensionContext?: { dpi: number; drawingScale: DrawingScaleInput };
}

function LabelPanelImpl({
  annotations,
  labels,
  selectedIds,
  hiddenClasses,
  onVisibilityChange,
  onSelect,
  onSelectMany,
  onDelete,
  onDeleteSelected,
  onRelabel,
  onRelabelMany,
  onCreateLabel,
  readonly = false,
  width = 220,
  height,
  dimensionContext,
  groupsCollapsed = false,
  annotationGroups,
  onGroupSelect,
  onGroupRename,
  onGroupRecolor,
  onGroupDelete,
  showOptional = false,
  optionalHidden = false,
  onOptionalVisibilityChange,
  onOptionalSelect,
}: Props) {
  const annotationGroupById = useMemo(
    () => new Map((annotationGroups ?? []).map((g) => [g.id, g])),
    [annotationGroups],
  );
  /*
   * The groups the user has flipped away from the default. Stored as a
   * difference rather than as the collapsed set, so that with `groupsCollapsed`
   * a class that arrives after mount starts collapsed like every other.
   */
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const isCollapsed = (key: string) => flipped.has(key) !== groupsCollapsed;
  const withOpen = (prev: Set<string>, keys: readonly string[], open: boolean) => {
    const next = new Set(prev);
    for (const key of keys) {
      if (open === groupsCollapsed) next.add(key);
      else next.delete(key);
    }
    return next;
  };
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  /*
   * Bumped by a group member's class arrow. Selecting that one annotation is not
   * a change when it was already the only one selected, and the list must still
   * scroll to its class.
   */
  const [revealTick, setRevealTick] = useState(0);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /*
   * Where a shift-click range starts. The last row the user picked deliberately
   * — by a plain or toggling click here, or by selecting a single shape on the
   * canvas — so extending a range behaves the way it does in a file list.
   */
  const rangeAnchor = useRef<string | null>(null);

  /*
   * Set when a group's name selected its members: the list stays where the
   * group is instead of jumping to the first member's class.
   */
  const keepScroll = useRef(false);

  // When canvas selection changes: auto-expand group + scroll row into view
  useEffect(() => {
    if (keepScroll.current) {
      keepScroll.current = false;
      return;
    }
    if (selectedIds.length === 0) return;
    const firstId = selectedIds[0]!;
    // One shape picked on the canvas is as deliberate as one row clicked here,
    // so a shift-click in the list extends from it.
    if (selectedIds.length === 1) rangeAnchor.current = firstId;
    const ann = annotations.find((a) => a.id === firstId);
    if (ann) {
      // Annotations whose label is not in the registry live in the unknown
      // bucket, which collapses under its own sentinel key.
      const key = labels.some((l) => l.canonicalClassId === ann.label)
        ? ann.label
        : UNGROUPED_KEY;
      setFlipped((prev) =>
        prev.has(key) !== groupsCollapsed ? withOpen(prev, [key], true) : prev,
      );
    }
    // Scroll the list container itself (not via scrollIntoView, which also
    // scrolls outer page ancestors when the canvas is embedded). Two rAFs so
    // the row exists after any group-expansion re-render + layout.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const container = listRef.current;
        const el = container?.querySelector<HTMLElement>(`[data-ann-id="${firstId}"]`);
        if (!el) return;
        // If our own list is the scroll container, scroll only it (avoids
        // scrolling the host page when the canvas is embedded). Otherwise the
        // host bounds the height a different way — fall back to scrollIntoView,
        // which walks up to whatever ancestor actually scrolls.
        if (container && container.scrollHeight > container.clientHeight + 1) {
          const cRect = container.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();
          const delta =
            eRect.top - cRect.top - (container.clientHeight / 2 - eRect.height / 2);
          container.scrollBy({ top: delta, behavior: "smooth" });
        } else {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [selectedIds, revealTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  /*
   * What the relabel popover is about to act on: one row, every row of a class,
   * or the whole selection. All three are the same popover over a list of ids —
   * the headline is what tells the user which of the three they opened.
   */
  const [relabelTarget, setRelabelTarget] = useState<{
    ids: string[];
    pos: { x: number; y: number };
    headline?: string;
  } | null>(null);

  // Popover width in its widest (symbol-size) phase, plus a gap — used to place
  // the relabel popover fully to the left of the panel, over the canvas, so it
  // never covers the annotation list.
  const RELABEL_POPOVER_CLEARANCE = 248;
  const openRelabel = (
    ids: string[],
    buttonRect: DOMRect,
    headline?: string,
  ) => {
    if (ids.length === 0) return;
    const panelLeft =
      panelRef.current?.getBoundingClientRect().left ?? buttonRect.left;
    setRelabelTarget({
      ids,
      pos: { x: panelLeft - RELABEL_POPOVER_CLEARANCE, y: buttonRect.top },
      ...(headline ? { headline } : {}),
    });
  };
  /** Bulk relabel needs a handler to bulk-relabel with. */
  const canBulkRelabel = !readonly && !!onRelabelMany;

  const filteredAnnotations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return annotations;
    return annotations.filter((a) => {
      const lm = labels.find((l) => l.canonicalClassId === a.label);
      const display = lm?.displayName ?? a.label;
      return (
        display.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    });
  }, [annotations, labels, query]);

  const grouped = labels
    .map((lm) => ({
      lm,
      items: filteredAnnotations.filter((a) => a.label === lm.canonicalClassId),
    }))
    .filter((g) => g.items.length > 0);

  const ungrouped = filteredAnnotations.filter(
    (a) => !labels.some((l) => l.canonicalClassId === a.label),
  );

  const groupMembers = useMemo(() => {
    const members = new Map<string, CanonicalAnnotation[]>();
    if (!annotationGroups) return members;
    for (const ann of filteredAnnotations) {
      if (ann.group === undefined || !annotationGroupById.has(ann.group)) continue;
      const list = members.get(ann.group);
      if (list) list.push(ann);
      else members.set(ann.group, [ann]);
    }
    return members;
  }, [annotationGroups, annotationGroupById, filteredAnnotations]);
  const visibleGroups = annotationGroups ?? [];

  /*
   * The Optional section: shown while optional marks are on and any mark is
   * optional, listing the ones that pass the filter. A flag rather than a
   * group, so a grouped optional mark is listed under both, and its class.
   */
  const hasOptional = showOptional && annotations.some((a) => a.optional === true);
  const optionalMembers = useMemo(
    () => (showOptional ? optionalMarks(filteredAnnotations) : EMPTY_MEMBERS),
    [showOptional, filteredAnnotations],
  );

  // ── Class visibility ──
  const hidden = hiddenClasses ?? EMPTY_SET;
  const presentLabelIds = useMemo(() => {
    const s = new Set<string>();
    annotations.forEach((a) => s.add(a.label));
    return s;
  }, [annotations]);
  const ungroupedLabelIds = useMemo(
    () => Array.from(new Set(ungrouped.map((a) => a.label))),
    [ungrouped],
  );
  const allHidden =
    presentLabelIds.size > 0 &&
    Array.from(presentLabelIds).every((id) => hidden.has(id));

  const setClassesHidden = (ids: string[], hide: boolean) => {
    if (!onVisibilityChange) return;
    const next = new Set(hidden);
    ids.forEach((id) => (hide ? next.add(id) : next.delete(id)));
    onVisibilityChange(next);
  };
  const toggleAll = () =>
    setClassesHidden(Array.from(presentLabelIds), !allHidden);

  const shortId = (id: string) => id.slice(0, 7);

  /*
   * Every row currently on screen, top to bottom — the order a shift-click
   * range runs along. Rows inside a collapsed group are not on it, because a
   * range the user cannot see is a range they did not mean to draw.
   */
  const flatRowIds: string[] = [];
  visibleGroups.forEach((g) => {
    if (isCollapsed(GROUP_KEY_PREFIX + g.id)) return;
    (groupMembers.get(g.id) ?? []).forEach((a) => flatRowIds.push(a.id));
  });
  if (hasOptional && !isCollapsed(OPTIONAL_KEY)) optionalMembers.forEach((a) => flatRowIds.push(a.id));
  grouped.forEach(({ lm, items }) => {
    if (isCollapsed(lm.canonicalClassId)) return;
    items.forEach((a) => flatRowIds.push(a.id));
  });
  if (!isCollapsed(UNGROUPED_KEY)) ungrouped.forEach((a) => flatRowIds.push(a.id));

  /**
   * Plain click selects the row. Cmd/Ctrl adds or removes one. Shift extends
   * from the last deliberate pick to here, the way a file list does — and falls
   * back to the old add-one behaviour when there is no anchor to extend from,
   * or when the consumer wired no `onSelectMany`.
   */
  const handleRowClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && onSelectMany && rangeAnchor.current) {
      const from = flatRowIds.indexOf(rangeAnchor.current);
      const to = flatRowIds.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        // A grouped annotation is listed twice, so a range can cross it twice.
        onSelectMany(Array.from(new Set(flatRowIds.slice(lo, hi + 1))));
        return;
      }
    }
    rangeAnchor.current = id;
    onSelect(id, e.shiftKey || e.metaKey || e.ctrlKey);
  };

  const selectGroup = (groupId: string) => {
    if (!onGroupSelect) return;
    const memberIds = annotations.filter((a) => a.group === groupId).map((a) => a.id);
    const unchanged =
      memberIds.length === selectedIds.length && memberIds.every((id) => selectedIds.includes(id));
    // An unchanged selection runs no effect to clear the flag, so none is set.
    keepScroll.current = memberIds.length > 0 && !unchanged;
    onGroupSelect(groupId);
  };

  const selectOptional = () => {
    if (!onOptionalSelect) return;
    const memberIds = optionalMarks(annotations).map((a) => a.id);
    const unchanged =
      memberIds.length === selectedIds.length && memberIds.every((id) => selectedIds.includes(id));
    keepScroll.current = memberIds.length > 0 && !unchanged;
    onOptionalSelect();
  };

  /** A group member's arrow: select only that annotation and show it under its class. */
  const revealInClass = (id: string) => {
    rangeAnchor.current = id;
    onSelect(id, false);
    setRevealTick((t) => t + 1);
  };

  const toggleCollapse = (classId: string) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  // ── Global collapse ──
  // Keys of every group currently rendered, so "collapse all" also folds the
  // unknown-label bucket and respects the active filter.
  const groupKeys = useMemo(() => {
    const keys = visibleGroups.map((g) => GROUP_KEY_PREFIX + g.id);
    if (hasOptional) keys.push(OPTIONAL_KEY);
    grouped.forEach((g) => keys.push(g.lm.canonicalClassId));
    if (ungrouped.length > 0) keys.push(UNGROUPED_KEY);
    return keys;
  }, [visibleGroups, hasOptional, grouped, ungrouped.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const allCollapsed =
    groupKeys.length > 0 && groupKeys.every((k) => isCollapsed(k));
  const toggleCollapseAll = () => {
    setFlipped((prev) => withOpen(prev, groupKeys, allCollapsed));
  };

  return (
    <div
      ref={panelRef}
      style={{
        width,
        minWidth: width,
        background: "var(--ae-bg-surface)",
        borderLeft: "1px solid var(--ae-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        /*
         * Use the explicit pixel height supplied by AnnotationCanvas (measured
         * via ResizeObserver) so scrolling works even when the client wraps us
         * in a container with no explicit height (e.g. w-3/5 with no h-*).
         * Fall back to 100% for the harness where the flex chain is complete.
         */
        height: height !== undefined ? height : "100%",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "10px 12px 8px",
          borderBottom: "1px solid var(--ae-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--ae-text-secondary)",
              fontWeight: 600,
            }}
          >
            Annotations
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {groupKeys.length > 0 && (
              <button
                title={allCollapsed ? "Expand all" : "Collapse all"}
                onClick={toggleCollapseAll}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  background: "none",
                  border: "1px solid var(--ae-border)",
                  borderRadius: 6,
                  color: "var(--ae-text-secondary)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 8 8"
                  fill="none"
                  style={{
                    transform: allCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                >
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {onVisibilityChange && presentLabelIds.size > 0 && (
              <button
                title={allHidden ? "Show all classes" : "Hide all classes"}
                onClick={toggleAll}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  background: "none",
                  border: "1px solid var(--ae-border)",
                  borderRadius: 6,
                  color: allHidden ? "var(--ae-text-muted)" : "var(--ae-text-secondary)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <EyeIcon open={!allHidden} />
              </button>
            )}
            {selectedIds.length > 1 && canBulkRelabel && (
              <button
                title={`Assign one class to all ${selectedIds.length} selected`}
                onClick={(e) =>
                  openRelabel(
                    selectedIds,
                    e.currentTarget.getBoundingClientRect(),
                    `Change class · ${selectedIds.length} selected`,
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  background: "var(--ae-selection)",
                  border: "1px solid var(--ae-accent)",
                  borderRadius: 6,
                  padding: "2px 6px",
                  color: "var(--ae-text-primary)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <PencilIcon />
                {selectedIds.length}
              </button>
            )}
            {selectedIds.length > 1 && !readonly && onDeleteSelected && (
              <button
                title={`Delete ${selectedIds.length} selected`}
                onClick={onDeleteSelected}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: 6,
                  padding: "2px 6px",
                  color: "var(--ae-danger)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {selectedIds.length}
              </button>
            )}
            <span
              style={{
                fontSize: 11,
                background: "var(--ae-bg-elevated)",
                borderRadius: 10,
                padding: "1px 7px",
                color: "var(--ae-text-primary)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
              }}
            >
              {annotations.length}
            </span>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--ae-text-muted)",
            }}
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.8" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "5px 8px 5px 26px",
              background: "var(--ae-bg-elevated)",
              border: "1px solid var(--ae-border)",
              borderRadius: 5,
              color: "var(--ae-text-primary)",
              fontSize: 12,
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 0.12s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ae-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ae-border)")}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ae-text-muted)",
                fontSize: 12,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          minHeight: 0,
          /* Thin custom scrollbar */
          scrollbarWidth: "thin",
          scrollbarColor: "var(--ae-border) transparent",
        }}
      >
        {annotationGroups && annotationGroups.length > 0 && (
          <GroupsSection
            groups={annotationGroups}
            members={groupMembers}
            selectedIds={selectedIds}
            readonly={readonly}
            isCollapsed={(groupId) => isCollapsed(GROUP_KEY_PREFIX + groupId)}
            onToggleCollapse={(groupId) => toggleCollapse(GROUP_KEY_PREFIX + groupId)}
            renderMember={(ann) => {
              const lm = labels.find((l) => l.canonicalClassId === ann.label);
              return (
                <AnnotationRow
                  key={ann.id}
                  ann={ann}
                  classLink={{
                    name: lm?.displayName ?? ann.label,
                    color: lm?.color ?? UNKNOWN_CLASS_COLOR,
                    onReveal: () => revealInClass(ann.id),
                  }}
                  isOptional={showOptional && ann.optional === true}
                  isSelected={selectedIds.includes(ann.id)}
                  isHovered={hoveredRow === ann.id}
                  readonly={readonly}
                  {...(dimensionContext ? { dimensionContext } : {})}
                  shortId={shortId}
                  onRowClick={handleRowClick}
                  onDelete={onDelete}
                  onRelabelRequest={openRelabel}
                  onMouseEnter={() => setHoveredRow(ann.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                />
              );
            }}
            onSelect={onGroupSelect ? selectGroup : undefined}
            onRename={onGroupRename}
            onRecolor={onGroupRecolor}
            onDelete={onGroupDelete}
          />
        )}

        {hasOptional && (
          <OptionalSection
            members={optionalMembers}
            selectedIds={selectedIds}
            collapsed={isCollapsed(OPTIONAL_KEY)}
            hidden={optionalHidden}
            onToggleCollapse={() => toggleCollapse(OPTIONAL_KEY)}
            onSelect={onOptionalSelect ? selectOptional : undefined}
            onToggleHidden={
              onOptionalVisibilityChange ? () => onOptionalVisibilityChange(!optionalHidden) : undefined
            }
            renderMember={(ann) => {
              const lm = labels.find((l) => l.canonicalClassId === ann.label);
              return (
                <AnnotationRow
                  key={ann.id}
                  ann={ann}
                  annotationGroup={ann.group === undefined ? undefined : annotationGroupById.get(ann.group)}
                  classLink={{
                    name: lm?.displayName ?? ann.label,
                    color: lm?.color ?? UNKNOWN_CLASS_COLOR,
                    onReveal: () => revealInClass(ann.id),
                  }}
                  isOptional
                  isSelected={selectedIds.includes(ann.id)}
                  isHovered={hoveredRow === ann.id}
                  readonly={readonly}
                  {...(dimensionContext ? { dimensionContext } : {})}
                  shortId={shortId}
                  onRowClick={handleRowClick}
                  onDelete={onDelete}
                  onRelabelRequest={openRelabel}
                  onMouseEnter={() => setHoveredRow(ann.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                />
              );
            }}
          />
        )}

        {grouped.length === 0 && ungrouped.length === 0 && (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "var(--ae-text-muted)",
              fontSize: 12,
            }}
          >
            {query ? "No matches" : "No annotations yet"}
          </div>
        )}

        {grouped.map(({ lm, items }) => {
          const groupCollapsed = isCollapsed(lm.canonicalClassId);
          const isHidden = hidden.has(lm.canonicalClassId);
          return (
            <div key={lm.canonicalClassId} style={{ opacity: isHidden ? 0.45 : 1 }}>
              {/* Sticky group header */}
              <div
                onClick={() => toggleCollapse(lm.canonicalClassId)}
                onMouseEnter={() => setHoveredGroup(lm.canonicalClassId)}
                onMouseLeave={() => setHoveredGroup(null)}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 10px 5px 12px",
                  cursor: "pointer",
                  background: "var(--ae-bg-surface)",
                  borderBottom: "1px solid var(--ae-border-subtle)",
                  borderTop: "1px solid var(--ae-border-subtle)",
                  userSelect: "none",
                }}
              >
                {/* Color swatch, the size of a group's so a class colour reads as easily */}
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: lm.color,
                    flexShrink: 0,
                    boxSizing: "border-box",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ae-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lm.displayName}
                </span>
                {hoveredGroup === lm.canonicalClassId && (
                  <div
                    style={{ display: "flex", gap: 2, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onSelectMany && (
                      <button
                        title={`Select all ${items.length} in ${lm.displayName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMany(items.map((a) => a.id));
                        }}
                        style={eyeBtn}
                      >
                        <SelectAllIcon />
                      </button>
                    )}
                    {canBulkRelabel && (
                      <button
                        title={`Move all ${items.length} ${lm.displayName} annotations to another class`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRelabel(
                            items.map((a) => a.id),
                            e.currentTarget.getBoundingClientRect(),
                            `${lm.displayName} → · ${items.length} annotations`,
                          );
                        }}
                        style={eyeBtn}
                      >
                        <PencilIcon />
                      </button>
                    )}
                  </div>
                )}
                {onVisibilityChange && (
                  <button
                    title={isHidden ? "Show on canvas" : "Hide from canvas"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setClassesHidden([lm.canonicalClassId], !isHidden);
                    }}
                    style={eyeBtn}
                  >
                    <EyeIcon open={!isHidden} />
                  </button>
                )}
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ae-text-secondary)",
                    background: "var(--ae-bg-elevated)",
                    borderRadius: 8,
                    padding: "1px 5px",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {items.length}
                </span>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="none"
                  style={{
                    flexShrink: 0,
                    color: "var(--ae-text-muted)",
                    transform: groupCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                >
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Rows */}
              {!groupCollapsed &&
                items.map((ann) => (
                  <AnnotationRow
                    key={ann.id}
                    ann={ann}
                    annotationGroup={ann.group === undefined ? undefined : annotationGroupById.get(ann.group)}
                    isOptional={showOptional && ann.optional === true}
                    isSelected={selectedIds.includes(ann.id)}
                    isHovered={hoveredRow === ann.id}
                    readonly={readonly}
                    {...(dimensionContext ? { dimensionContext } : {})}
                    shortId={shortId}
                    onRowClick={handleRowClick}
                    onDelete={onDelete}
                    onRelabelRequest={openRelabel}
                    onMouseEnter={() => setHoveredRow(ann.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  />
                ))}
            </div>
          );
        })}

        {/* Unknown-label annotations */}
        {ungrouped.length > 0 && (() => {
          const unknownHidden =
            ungroupedLabelIds.length > 0 &&
            ungroupedLabelIds.every((id) => hidden.has(id));
          const unknownCollapsed = isCollapsed(UNGROUPED_KEY);
          return (
          <div style={{ opacity: unknownHidden ? 0.45 : 1 }}>
            <div
              onClick={() => toggleCollapse(UNGROUPED_KEY)}
              onMouseEnter={() => setHoveredGroup(UNGROUPED_KEY)}
              onMouseLeave={() => setHoveredGroup(null)}
              style={{
                cursor: "pointer",
                position: "sticky",
                top: 0,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 10px 5px 12px",
                background: "var(--ae-bg-surface)",
                borderBottom: "1px solid var(--ae-border-subtle)",
                borderTop: "1px solid var(--ae-border-subtle)",
                fontSize: 11,
                color: "var(--ae-text-muted)",
                fontStyle: "italic",
              }}
            >
              <span style={{ flex: 1 }}>Unknown label ({ungrouped.length})</span>
              {hoveredGroup === UNGROUPED_KEY && (
                <div
                  style={{ display: "flex", gap: 2, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {onSelectMany && (
                    <button
                      title={`Select all ${ungrouped.length} unknown-label annotations`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMany(ungrouped.map((a) => a.id));
                      }}
                      style={eyeBtn}
                    >
                      <SelectAllIcon />
                    </button>
                  )}
                  {canBulkRelabel && (
                    <button
                      title={`Move all ${ungrouped.length} unknown-label annotations to a class`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRelabel(
                          ungrouped.map((a) => a.id),
                          e.currentTarget.getBoundingClientRect(),
                          `Unknown label → · ${ungrouped.length} annotations`,
                        );
                      }}
                      style={eyeBtn}
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>
              )}
              {onVisibilityChange && (
                <button
                  title={unknownHidden ? "Show on canvas" : "Hide from canvas"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setClassesHidden(ungroupedLabelIds, !unknownHidden);
                  }}
                  style={eyeBtn}
                >
                  <EyeIcon open={!unknownHidden} />
                </button>
              )}
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="none"
                style={{
                  flexShrink: 0,
                  color: "var(--ae-text-muted)",
                  transform: unknownCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              >
                <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {!unknownCollapsed && ungrouped.map((ann) => (
              <AnnotationRow
                key={ann.id}
                ann={ann}
                    annotationGroup={ann.group === undefined ? undefined : annotationGroupById.get(ann.group)}
                isOptional={showOptional && ann.optional === true}
                isSelected={selectedIds.includes(ann.id)}
                isHovered={hoveredRow === ann.id}
                readonly={readonly}
                {...(dimensionContext ? { dimensionContext } : {})}
                shortId={shortId}
                onRowClick={handleRowClick}
                onDelete={onDelete}
                onRelabelRequest={openRelabel}
                onMouseEnter={() => setHoveredRow(ann.id)}
                onMouseLeave={() => setHoveredRow(null)}
                indent={12}
              />
            ))}
          </div>
          );
        })()}

        {/* Bottom padding so last row isn't flush against the edge */}
        <div style={{ height: 8 }} />
      </div>

      {relabelTarget && (() => {
        // Only a single-row relabel pre-fills the size fields: across many
        // annotations there is no one size to show, and showing the first
        // one's would stamp it onto all the rest on the next Enter.
        const relabelAnn = relabelTarget.ids.length === 1
          ? annotations.find((a) => a.id === relabelTarget.ids[0])
          : undefined;
        const initialSize = parseSymbolSize(relabelAnn?.meta);
        // Rendered in place (keeps the theme's CSS variables) but positioned
        // with `fixed` + viewport coordinates so it escapes the panel's
        // overflow:hidden clip instead of vanishing the list behind it.
        return (
          <LabelPopover
            labels={labels}
            position={relabelTarget.pos}
            positionStrategy="fixed"
            {...(initialSize ? { initialSymbolSize: initialSize } : {})}
            {...(relabelTarget.headline ? { headline: relabelTarget.headline } : {})}
            onSelect={(label, symbolSize) => {
              if (relabelTarget.ids.length === 1) {
                onRelabel(relabelTarget.ids[0]!, label, symbolSize);
              } else {
                onRelabelMany?.(relabelTarget.ids, label, symbolSize);
              }
              setRelabelTarget(null);
            }}
            onCancel={() => setRelabelTarget(null)}
            onCreateLabel={onCreateLabel}
          />
        );
      })()}
    </div>
  );
}

/**
 * The groups on this image, above the class sections, each listing its members
 * the way a class lists its own.
 *
 * A group's name selects every member, which is what a group is for; its
 * chevron folds it, like a class header's. Renaming has a pencil beside the
 * name because a double click alone was missed, and the field swallows its keys
 * so typing a name never fires a canvas shortcut. Deleting a group ungroups its
 * members and deletes nothing else, which is why it asks for no confirmation:
 * it is one undo step.
 */
function GroupsSection({
  groups,
  members,
  selectedIds,
  readonly,
  isCollapsed,
  onToggleCollapse,
  renderMember,
  onSelect,
  onRename,
  onRecolor,
  onDelete,
}: {
  groups: AnnotationGroup[];
  /** Each group's members that pass the filter, in list order. */
  members: ReadonlyMap<string, CanonicalAnnotation[]>;
  selectedIds: string[];
  readonly: boolean;
  isCollapsed: (groupId: string) => boolean;
  onToggleCollapse: (groupId: string) => void;
  renderMember: (ann: CanonicalAnnotation) => React.ReactNode;
  onSelect?: ((groupId: string) => void) | undefined;
  onRename?: ((groupId: string, name: string) => void) | undefined;
  onRecolor?: ((groupId: string, color: string) => void) | undefined;
  onDelete?: ((groupId: string) => void) | undefined;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [open, setOpen] = useState(true);
  const canRename = !readonly && !!onRename;

  const startRename = (group: AnnotationGroup) => {
    if (!canRename) return;
    setDraftName(group.name);
    setRenaming(group.id);
  };
  const commitRename = (groupId: string) => {
    onRename?.(groupId, draftName);
    setRenaming(null);
  };

  return (
    <div style={{ borderBottom: "1px solid var(--ae-border)" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ae-text-secondary)",
          fontWeight: 600,
          userSelect: "none",
        }}
      >
        <span style={{ flex: 1 }}>Groups</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ae-text-muted)" }}>{groups.length}</span>
        <Chevron collapsed={!open} />
      </div>
      {open &&
        groups.map((group) => {
          const items = members.get(group.id) ?? EMPTY_MEMBERS;
          const collapsed = isCollapsed(group.id);
          const allSelected = items.length > 0 && items.every((a) => selectedIds.includes(a.id));
          return (
            <div key={group.id} data-group-id={group.id}>
              <div
                onClick={() => onSelect?.(group.id)}
                title={onSelect ? `Select the ${items.length} annotations in ${group.name}` : undefined}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 10px 5px 12px",
                  minHeight: 26,
                  boxSizing: "border-box",
                  cursor: onSelect ? "pointer" : "default",
                  background: allSelected ? "var(--ae-selection)" : "var(--ae-bg-surface)",
                  borderTop: "1px solid var(--ae-border-subtle)",
                  borderBottom: "1px solid var(--ae-border-subtle)",
                  borderLeft: allSelected ? "2px solid var(--ae-accent)" : "2px solid transparent",
                  userSelect: "none",
                }}
              >
                <label
                  title={readonly || !onRecolor ? group.color : "Change the group's colour"}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "relative",
                    boxSizing: "border-box",
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: group.color,
                    flexShrink: 0,
                    cursor: readonly || !onRecolor ? "default" : "pointer",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  {!readonly && onRecolor && (
                    <input
                      type="color"
                      aria-label={`Colour of group ${group.name}`}
                      value={group.color.toLowerCase()}
                      onChange={(e) => onRecolor(group.id, e.target.value)}
                      style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: 0, padding: 0 }}
                    />
                  )}
                </label>
                {renaming === group.id ? (
                  <input
                    autoFocus
                    aria-label={`Name of group ${group.name}`}
                    value={draftName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(group.id)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename(group.id);
                      else if (e.key === "Escape") setRenaming(null);
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: "var(--ae-bg-elevated)",
                      border: "1px solid var(--ae-accent)",
                      borderRadius: 3,
                      padding: "1px 4px",
                      color: "var(--ae-text-primary)",
                      fontSize: 12,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(group);
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--ae-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.name}
                  </span>
                )}
                {canRename && renaming !== group.id && (
                  <button
                    type="button"
                    title={`Rename ${group.name}`}
                    aria-label={`Rename group ${group.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(group);
                    }}
                    style={actionBtn}
                  >
                    <PencilIcon />
                  </button>
                )}
                {!readonly && onDelete && (
                  <button
                    type="button"
                    title={`Delete the group ${group.name}. Its annotations stay, ungrouped.`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(group.id);
                    }}
                    style={{ ...actionBtn, color: "var(--ae-danger)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <span style={countBadge}>{items.length}</span>
                <button
                  type="button"
                  title={collapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
                  aria-expanded={!collapsed}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(group.id);
                  }}
                  style={actionBtn}
                >
                  <Chevron collapsed={collapsed} />
                </button>
              </div>
              {!collapsed && items.map(renderMember)}
            </div>
          );
        })}
    </div>
  );
}

/**
 * Every optional mark in one place, beside the Groups section and built like one
 * of its groups: the name selects them all, the chevron folds them, and each row
 * links to its class. The eye hides optional marks from the canvas, as a class's
 * eye hides that class.
 */
function OptionalSection({
  members,
  selectedIds,
  collapsed,
  hidden,
  onToggleCollapse,
  onSelect,
  onToggleHidden,
  renderMember,
}: {
  /** The optional marks that pass the filter, in list order. */
  members: CanonicalAnnotation[];
  selectedIds: string[];
  collapsed: boolean;
  hidden: boolean;
  onToggleCollapse: () => void;
  onSelect?: (() => void) | undefined;
  onToggleHidden?: (() => void) | undefined;
  renderMember: (ann: CanonicalAnnotation) => React.ReactNode;
}) {
  const allSelected = members.length > 0 && members.every((a) => selectedIds.includes(a.id));
  return (
    <div data-optional-section style={{ borderBottom: "1px solid var(--ae-border)", opacity: hidden ? 0.45 : 1 }}>
      <div
        onClick={() => onSelect?.()}
        title={onSelect ? `Select the ${members.length} optional annotations` : undefined}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 10px 5px 12px",
          minHeight: 26,
          boxSizing: "border-box",
          cursor: onSelect ? "pointer" : "default",
          background: allSelected ? "var(--ae-selection)" : "var(--ae-bg-surface)",
          borderTop: "1px solid var(--ae-border-subtle)",
          borderBottom: "1px solid var(--ae-border-subtle)",
          borderLeft: allSelected ? "2px solid var(--ae-accent)" : "2px solid transparent",
          userSelect: "none",
        }}
      >
        <span
          aria-hidden
          style={{
            boxSizing: "border-box",
            width: 12,
            height: 12,
            borderRadius: 3,
            border: "1.5px dashed var(--ae-text-secondary)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 500,
            color: "var(--ae-text-primary)",
          }}
        >
          Optional
        </span>
        {onToggleHidden && (
          <button
            type="button"
            title={hidden ? "Show optional marks on canvas" : "Hide optional marks from canvas"}
            aria-label={hidden ? "Show optional marks on canvas" : "Hide optional marks from canvas"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden();
            }}
            style={eyeBtn}
          >
            <EyeIcon open={!hidden} />
          </button>
        )}
        <span style={countBadge}>{members.length}</span>
        <button
          type="button"
          title={collapsed ? "Expand Optional" : "Collapse Optional"}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          style={actionBtn}
        >
          <Chevron collapsed={collapsed} />
        </button>
      </div>
      {!collapsed && members.map(renderMember)}
    </div>
  );
}

interface AnnotationRowProps {
  ann: CanonicalAnnotation;
  /** The group this row's annotation is in, when grouping is on and it has one. */
  annotationGroup?: AnnotationGroup | undefined;
  /**
   * Set when the row is listed under its group rather than its class: names the
   * class it belongs to, and the arrow that jumps to it there.
   */
  classLink?: { name: string; color: string; onReveal: () => void } | undefined;
  /** Shows the optional tag. The panel sets it only when optional marks are on. */
  isOptional?: boolean;
  isSelected: boolean;
  isHovered: boolean;
  readonly: boolean;
  dimensionContext?: { dpi: number; drawingScale: DrawingScaleInput };
  shortId: (id: string) => string;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onRelabelRequest: (ids: string[], buttonRect: DOMRect) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  indent?: number;
}

function AnnotationRow({
  ann,
  annotationGroup,
  classLink,
  isOptional = false,
  isSelected,
  isHovered,
  readonly,
  dimensionContext,
  shortId,
  onRowClick,
  onDelete,
  onRelabelRequest,
  onMouseEnter,
  onMouseLeave,
  indent = 24,
}: AnnotationRowProps) {
  const symbolSize = parseSymbolSize(ann.meta);
  const calculatedSize = dimensionContext
    ? formatAnnotationCalculatedSize(
        ann,
        dimensionContext.dpi,
        dimensionContext.drawingScale,
      )
    : "";
  const perimeter = dimensionContext
    ? formatAnnotationPerimeter(
        ann,
        dimensionContext.dpi,
        dimensionContext.drawingScale,
      )
    : "";
  const sizeLineCount =
    (calculatedSize ? 1 : 0) + (perimeter ? 1 : 0) + (symbolSize ? 1 : 0);
  const hasSizes = sizeLineCount > 0;

  return (
    <div
      // A group member is a second row for the same annotation. Only the class
      // row carries data-ann-id, so revealing a selection scrolls to its class.
      {...(classLink ? { "data-group-member-id": ann.id } : { "data-ann-id": ann.id })}
      onClick={(e) => onRowClick(ann.id, e)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: `5px 8px 5px ${indent}px`,
        cursor: "pointer",
        background: isSelected
          ? "var(--ae-selection)"
          : isHovered
          ? "var(--ae-bg-elevated)"
          : "transparent",
        borderLeft: isSelected
          ? "2px solid var(--ae-accent)"
          : "2px solid transparent",
        transition: "background 0.08s",
        minHeight: hasSizes ? 28 + 14 * sizeLineCount : 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            color: isSelected
              ? "var(--ae-text-primary)"
              : "var(--ae-text-secondary)",
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          #{shortId(ann.id)}
        </span>

        {isOptional && (
          <span
            title="Optional"
            style={{
              flexShrink: 0,
              fontSize: 9,
              lineHeight: "12px",
              padding: "0 4px",
              borderRadius: 3,
              border: "1px dashed var(--ae-text-secondary)",
              color: "var(--ae-text-secondary)",
            }}
          >
            Optional
          </span>
        )}

        {classLink && (
          <button
            type="button"
            title={`Show in ${classLink.name}`}
            onClick={(e) => {
              e.stopPropagation();
              classLink.onReveal();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              maxWidth: 96,
              minWidth: 0,
              flexShrink: 1,
              background: "none",
              border: "none",
              borderRadius: 3,
              padding: "1px 2px",
              fontSize: 9,
              color: "var(--ae-text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 1, background: classLink.color, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {classLink.name}
            </span>
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {annotationGroup && !classLink && (
          <span
            title={`In group ${annotationGroup.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              maxWidth: 72,
              fontSize: 9,
              color: "var(--ae-text-secondary)",
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 1, background: annotationGroup.color, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {annotationGroup.name}
            </span>
          </span>
        )}

        <span
          style={{
            fontSize: 10,
            color: "var(--ae-text-muted)",
            flexShrink: 0,
          }}
        >
          {ann.type}
        </span>

        <span
          style={{
            fontSize: 9,
            borderRadius: 3,
            padding: "1px 4px",
            background:
              ann.source === "human"
                ? "rgba(99,102,241,0.18)"
                : "var(--ae-bg-elevated)",
            color:
              ann.source === "human"
                ? "#a5b4fc"
                : "var(--ae-text-muted)",
            border: `1px solid ${
              ann.source === "human"
                ? "rgba(99,102,241,0.3)"
                : "var(--ae-border)"
            }`,
            flexShrink: 0,
            lineHeight: "14px",
          }}
        >
          {ann.source === "human" ? "H" : "AI"}
        </span>

        {isHovered && !readonly && (
          <div
            style={{ display: "flex", gap: 2, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="Relabel"
              onClick={(e) => {
                e.stopPropagation();
                onRelabelRequest([ann.id], e.currentTarget.getBoundingClientRect());
              }}
              style={actionBtn}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ann.id);
              }}
              style={{ ...actionBtn, color: "var(--ae-danger)" }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {hasSizes && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontSize: 11,
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            color: "var(--ae-text-primary)",
            lineHeight: 1.4,
          }}
        >
          {calculatedSize && <span>{calculatedSize}</span>}
          {perimeter && (
            <span style={{ color: "var(--ae-text-secondary)" }}>
              P {perimeter}
            </span>
          )}
          {symbolSize && <span>{formatSymbolSizeLabel(symbolSize)}</span>}
        </div>
      )}
    </div>
  );
}

/** Swatch beside a group member whose label is in no class. */
const UNKNOWN_CLASS_COLOR = "#8a8a8a";

/** Collapse key for the unknown-label bucket — no real class id can collide with it. */
const UNGROUPED_KEY = "__ungrouped__";

/** Collapse keys for annotation groups are prefixed so no class id can collide with one. */
const GROUP_KEY_PREFIX = "__group__:";

/** Collapse key of the Optional section, beside the groups' and classes'. */
const OPTIONAL_KEY = "__optional__";

const EMPTY_SET: ReadonlySet<string> = new Set();

const EMPTY_MEMBERS: CanonicalAnnotation[] = [];

const countBadge: React.CSSProperties = {
  fontSize: 10,
  color: "var(--ae-text-secondary)",
  background: "var(--ae-bg-elevated)",
  borderRadius: 8,
  padding: "1px 5px",
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};

/** Down when open, right when folded. */
function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="none"
      style={{
        flexShrink: 0,
        color: "var(--ae-text-muted)",
        transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
        transition: "transform 0.15s",
      }}
    >
      <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const eyeBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ae-text-secondary)",
  borderRadius: 3,
  padding: 0,
  flexShrink: 0,
};

/** Pencil — relabel, one row or many. */
function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Stacked rows with a tick — select every annotation in this group. */
function SelectAllIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 3.5h9M2 7h6M2 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 11.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Eye (visible) / eye-off (hidden) toggle icon. */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M6.3 3.7A6.9 6.9 0 018 3.5c4.5 0 7 4.5 7 4.5a13 13 0 01-2.2 2.7M9.7 12.3A6.9 6.9 0 018 12.5C3.5 12.5 1 8 1 8a13 13 0 013.3-3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.6 6.6a2 2 0 002.8 2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const actionBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ae-text-secondary)",
  borderRadius: 3,
  padding: 0,
  flexShrink: 0,
};

/*
 * Memoised, because the panel is a row of DOM per annotation and none of those
 * rows reads the viewport. The canvas re-renders on every wheel tick and every
 * pan mousemove; without this the panel re-rendered every row with it, and on
 * a drawing carrying a hundred and forty marks that was the difference between
 * a pan that follows the hand and one that moves in steps. The handlers it is
 * given are held stable on the canvas side for the same reason.
 */
export const LabelPanel = React.memo(LabelPanelImpl);
