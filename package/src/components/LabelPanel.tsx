"use client";

import React, { useState } from "react";
import type { CanonicalAnnotation, LabelMap } from "../types/canonical";
import { LabelPopover } from "./LabelPopover";

interface Props {
  annotations: CanonicalAnnotation[];
  labels: LabelMap[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRelabel: (id: string, label: string) => void;
  onCreateLabel?: ((displayName: string) => string) | undefined;
  width?: number;
}

export function LabelPanel({
  annotations,
  labels,
  selectedId,
  onSelect,
  onDelete,
  onRelabel,
  onCreateLabel,
  width = 220,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [relabelTarget, setRelabelTarget] = useState<{
    id: string;
    pos: { x: number; y: number };
  } | null>(null);

  const grouped = labels
    .map((lm) => ({
      lm,
      items: annotations.filter((a) => a.label === lm.canonicalClassId),
    }))
    .filter((g) => g.items.length > 0);

  const ungrouped = annotations.filter(
    (a) => !labels.some((l) => l.canonicalClassId === a.label),
  );

  const shortId = (id: string) => id.slice(0, 6);

  return (
    <div
      style={{
        width,
        background: "var(--ae-bg-surface)",
        borderLeft: "1px solid var(--ae-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--ae-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ae-text-secondary)",
          }}
        >
          Annotations
        </span>
        <span
          style={{
            fontSize: 11,
            background: "var(--ae-bg-elevated)",
            borderRadius: 10,
            padding: "1px 6px",
            color: "var(--ae-text-primary)",
          }}
        >
          {annotations.length}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {grouped.map(({ lm, items }) => {
          const isCollapsed = collapsed.has(lm.canonicalClassId);
          return (
            <div key={lm.canonicalClassId}>
              {/* Group header */}
              <div
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(lm.canonicalClassId))
                      next.delete(lm.canonicalClassId);
                    else next.add(lm.canonicalClassId);
                    return next;
                  })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--ae-border-subtle)",
                  userSelect: "none",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: lm.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--ae-text-primary)",
                  }}
                >
                  {lm.displayName}
                </span>
                <span
                  style={{ fontSize: 11, color: "var(--ae-text-secondary)" }}
                >
                  ({items.length})
                </span>
                <span style={{ fontSize: 10, color: "var(--ae-text-muted)" }}>
                  {isCollapsed ? "▶" : "▼"}
                </span>
              </div>

              {/* Annotation rows */}
              {!isCollapsed &&
                items.map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => onSelect(ann.id)}
                    onMouseEnter={() => setHoveredRow(ann.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 12px 4px 28px",
                      cursor: "pointer",
                      background:
                        selectedId === ann.id
                          ? "var(--ae-selection)"
                          : hoveredRow === ann.id
                            ? "var(--ae-bg-elevated)"
                            : "transparent",
                      borderBottom: "1px solid var(--ae-bg-surface)",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: "var(--ae-text-secondary)",
                        fontFamily: "monospace",
                      }}
                    >
                      #{shortId(ann.id)}
                    </span>
                    <span
                      style={{ fontSize: 11, color: "var(--ae-text-muted)" }}
                    >
                      {ann.type}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        borderRadius: 3,
                        padding: "1px 4px",
                        background:
                          ann.source === "human"
                            ? "var(--ae-accent-hover)"
                            : "var(--ae-border)",
                        color:
                          ann.source === "human"
                            ? "#93c5fd"
                            : "var(--ae-text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      {ann.source === "human" ? "H" : "AI"}
                    </span>
                    {hoveredRow === ann.id && (
                      <>
                        <button
                          title="Relabel"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            setRelabelTarget({
                              id: ann.id,
                              pos: { x: rect.left - 200, y: rect.top },
                            });
                          }}
                          style={{ ...iconBtn }}
                        >
                          ✎
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(ann.id);
                          }}
                          style={{ ...iconBtn, color: "var(--ae-danger)" }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
        {ungrouped.map((ann) => (
          <div
            key={ann.id}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              color: "var(--ae-text-muted)",
            }}
          >
            #{shortId(ann.id)} (unknown label)
          </div>
        ))}
      </div>

      {relabelTarget && (
        <LabelPopover
          labels={labels}
          position={relabelTarget.pos}
          onSelect={(label) => {
            onRelabel(relabelTarget.id, label);
            setRelabelTarget(null);
          }}
          onCancel={() => setRelabelTarget(null)}
          onCreateLabel={onCreateLabel}
        />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ae-text-secondary)",
  fontSize: 12,
  padding: "0 2px",
  lineHeight: 1,
};
