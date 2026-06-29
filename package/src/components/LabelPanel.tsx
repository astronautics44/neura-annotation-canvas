"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { CanonicalAnnotation, LabelMap, SymbolSize } from "../types/canonical";
import { LabelPopover } from "./LabelPopover";
import { formatSymbolSizeLabel, parseSymbolSize } from "../utils/symbolSize";
import {
  formatAnnotationCalculatedSize,
  type DrawingScaleInput,
} from "../utils/dimensions";

interface Props {
  annotations: CanonicalAnnotation[];
  labels: LabelMap[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onDelete: (id: string) => void;
  onDeleteSelected?: () => void;
  onRelabel: (id: string, label: string, symbolSize?: SymbolSize) => void;
  onCreateLabel?: ((displayName: string) => string) | undefined;
  readonly?: boolean;
  width?: number;
  height?: number;
  /** When both dpi and drawing scale are set, calculated sizes appear in the list. */
  dimensionContext?: { dpi: number; drawingScale: DrawingScaleInput };
}

export function LabelPanel({
  annotations,
  labels,
  selectedIds,
  onSelect,
  onDelete,
  onDeleteSelected,
  onRelabel,
  onCreateLabel,
  readonly = false,
  width = 220,
  height,
  dimensionContext,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // When canvas selection changes: auto-expand group + scroll row into view
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const firstId = selectedIds[0]!;
    const ann = annotations.find((a) => a.id === firstId);
    if (ann) {
      setCollapsed((prev) => {
        if (!prev.has(ann.label)) return prev;
        const next = new Set(prev);
        next.delete(ann.label);
        return next;
      });
    }
    // Defer scroll until after possible group-expansion re-render
    setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-ann-id="${firstId}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState("");
  const [relabelTarget, setRelabelTarget] = useState<{
    id: string;
    pos: { x: number; y: number };
  } | null>(null);

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

  const shortId = (id: string) => id.slice(0, 7);

  const toggleCollapse = (classId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  return (
    <div
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
          const isCollapsed = collapsed.has(lm.canonicalClassId);
          return (
            <div key={lm.canonicalClassId}>
              {/* Sticky group header */}
              <div
                onClick={() => toggleCollapse(lm.canonicalClassId)}
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
                {/* Color swatch */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: lm.color,
                    flexShrink: 0,
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
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                >
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Rows */}
              {!isCollapsed &&
                items.map((ann) => (
                  <AnnotationRow
                    key={ann.id}
                    ann={ann}
                    isSelected={selectedIds.includes(ann.id)}
                    isHovered={hoveredRow === ann.id}
                    readonly={readonly}
                    {...(dimensionContext ? { dimensionContext } : {})}
                    shortId={shortId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onRelabelRequest={(id, pos) => setRelabelTarget({ id, pos })}
                    onMouseEnter={() => setHoveredRow(ann.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  />
                ))}
            </div>
          );
        })}

        {/* Unknown-label annotations */}
        {ungrouped.length > 0 && (
          <div>
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                padding: "5px 12px",
                background: "var(--ae-bg-surface)",
                borderBottom: "1px solid var(--ae-border-subtle)",
                borderTop: "1px solid var(--ae-border-subtle)",
                fontSize: 11,
                color: "var(--ae-text-muted)",
                fontStyle: "italic",
              }}
            >
              Unknown label ({ungrouped.length})
            </div>
            {ungrouped.map((ann) => (
              <AnnotationRow
                key={ann.id}
                ann={ann}
                isSelected={selectedIds.includes(ann.id)}
                isHovered={hoveredRow === ann.id}
                readonly={readonly}
                {...(dimensionContext ? { dimensionContext } : {})}
                shortId={shortId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRelabelRequest={(id, pos) => setRelabelTarget({ id, pos })}
                onMouseEnter={() => setHoveredRow(ann.id)}
                onMouseLeave={() => setHoveredRow(null)}
                indent={12}
              />
            ))}
          </div>
        )}

        {/* Bottom padding so last row isn't flush against the edge */}
        <div style={{ height: 8 }} />
      </div>

      {relabelTarget && (() => {
        const relabelAnn = annotations.find((a) => a.id === relabelTarget.id);
        const initialSize = parseSymbolSize(relabelAnn?.meta);
        return (
          <LabelPopover
            labels={labels}
            position={relabelTarget.pos}
            {...(initialSize ? { initialSymbolSize: initialSize } : {})}
            onSelect={(label, symbolSize) => {
              onRelabel(relabelTarget.id, label, symbolSize);
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

interface AnnotationRowProps {
  ann: CanonicalAnnotation;
  isSelected: boolean;
  isHovered: boolean;
  readonly: boolean;
  dimensionContext?: { dpi: number; drawingScale: DrawingScaleInput };
  shortId: (id: string) => string;
  onSelect: (id: string, additive: boolean) => void;
  onDelete: (id: string) => void;
  onRelabelRequest: (id: string, pos: { x: number; y: number }) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  indent?: number;
}

function AnnotationRow({
  ann,
  isSelected,
  isHovered,
  readonly,
  dimensionContext,
  shortId,
  onSelect,
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
  const hasSizes = Boolean(symbolSize || calculatedSize);

  return (
    <div
      data-ann-id={ann.id}
      onClick={(e) =>
        onSelect(ann.id, e.shiftKey || e.metaKey || e.ctrlKey)
      }
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
        minHeight: hasSizes ? (symbolSize && calculatedSize ? 54 : 42) : 28,
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
                const rect = e.currentTarget.getBoundingClientRect();
                onRelabelRequest(ann.id, { x: rect.left - 200, y: rect.top });
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

      {(calculatedSize || symbolSize) && (
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
          {symbolSize && <span>{formatSymbolSizeLabel(symbolSize)}</span>}
        </div>
      )}
    </div>
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
