"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LabelMap } from "../types/canonical";

interface Props {
  labels: LabelMap[];
  position: { x: number; y: number };
  onSelect: (canonicalClassId: string) => void;
  onCancel: () => void;
  onCreateLabel?: (displayName: string) => string; // returns canonicalClassId of the new label
}

export function LabelPopover({ labels, position, onSelect, onCancel, onCreateLabel }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = labels.filter((l) =>
    l.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  // show "Create" row when query is non-empty, no exact match, and creation is allowed
  const trimmed = query.trim();
  const exactMatch = labels.some((l) => l.displayName.toLowerCase() === trimmed.toLowerCase());
  const showCreate = !!onCreateLabel && trimmed.length > 0 && !exactMatch;

  // total navigable rows = filtered + (showCreate ? 1 : 0)
  const totalRows = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => {
    inputRef.current?.focus();
    if (labels.length === 1 && labels[0] && !onCreateLabel) {
      onSelect(labels[0].canonicalClassId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCursor(0); }, [query]);

  const commitCursor = () => {
    if (cursor < filtered.length) {
      const item = filtered[cursor];
      if (item) onSelect(item.canonicalClassId);
    } else if (showCreate) {
      handleCreate();
    }
  };

  const handleCreate = () => {
    if (!onCreateLabel || !trimmed) return;
    const id = onCreateLabel(trimmed);
    onSelect(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, totalRows - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); commitCursor(); }
    else if (e.key === "Escape") { onCancel(); }
  };

  return (
    <div style={{
      position: "absolute",
      left: Math.min(position.x, window.innerWidth - 210),
      top: Math.min(position.y, window.innerHeight - 320),
      width: 200,
      background: "var(--ae-bg-surface)",
      border: "1px solid var(--ae-border)",
      borderRadius: 6,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      zIndex: 200,
      overflow: "hidden",
    }}>
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--ae-border-subtle)" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or create label…"
          style={{
            width: "100%", background: "var(--ae-bg-elevated)", border: "1px solid var(--ae-border)",
            borderRadius: 4, padding: "4px 8px", color: "var(--ae-text-primary)",
            fontSize: 12, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {filtered.length === 0 && !showCreate && (
          <div style={{ padding: "8px 12px", color: "var(--ae-text-muted)", fontSize: 12 }}>No results</div>
        )}

        {filtered.map((lm, i) => (
          <div
            key={lm.canonicalClassId}
            onClick={() => onSelect(lm.canonicalClassId)}
            onMouseEnter={() => setCursor(i)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", cursor: "pointer",
              background: i === cursor ? "var(--ae-accent)" : "transparent",
              color: i === cursor ? "#ffffff" : "var(--ae-text-primary)",
              fontSize: 13,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: lm.color, flexShrink: 0 }} />
            {lm.displayName}
          </div>
        ))}

        {showCreate && (
          <>
            {filtered.length > 0 && (
              <div style={{ height: 1, background: "var(--ae-border-subtle)", margin: "2px 0" }} />
            )}
            <div
              onClick={handleCreate}
              onMouseEnter={() => setCursor(filtered.length)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", cursor: "pointer",
                background: cursor === filtered.length ? "var(--ae-accent)" : "transparent",
                color: cursor === filtered.length ? "#ffffff" : "var(--ae-success)",
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              Create <strong style={{ marginLeft: 2 }}>&ldquo;{trimmed}&rdquo;</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
