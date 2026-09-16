"use client";

import React, { useEffect, useRef, useState } from "react";
import type { AnnotationGroup } from "../types/canonical";

interface Props {
  groups: AnnotationGroup[];
  /** Members per group id, for the count beside each name. */
  memberCounts: ReadonlyMap<string, number>;
  /** How many annotations the pick applies to. */
  count: number;
  /** Whether any of them is in a group, which is when "Remove from group" means something. */
  canRemove: boolean;
  position: { x: number; y: number };
  onPick: (groupId: string) => void;
  onCreate: (name: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}

const POPOVER_WIDTH = 240;

/**
 * Put a selection into a group, a new one or an existing one, or take it out.
 *
 * Typed rather than clicked first, like the label popover beside it: a drawing
 * with a dozen rooms is a list somebody searches, and a name that matches none
 * of them is the new group. Enter picks the highlighted row.
 */
export function GroupPopover({
  groups,
  memberCounts,
  count,
  canRemove,
  position,
  onPick,
  onCreate,
  onRemove,
  onCancel,
}: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(trimmed.toLowerCase()));
  const exactMatch = groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;
  const totalRows = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onCancel]);

  const commitCursor = () => {
    const picked = filtered[cursor];
    if (picked) onPick(picked.id);
    else if (showCreate) onCreate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Nothing typed here is a canvas shortcut: `G`, `R` and Backspace belong to
    // the field while it has focus.
    e.stopPropagation();
    if (e.key === "Escape") onCancel();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(totalRows - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitCursor();
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "absolute",
        left: Math.max(8, position.x - POPOVER_WIDTH / 2),
        top: position.y,
        width: POPOVER_WIDTH,
        background: "var(--ae-bg-surface)",
        border: "1px solid var(--ae-border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "6px 10px 0",
          fontSize: 10,
          color: "var(--ae-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Group · {count} selected
      </div>
      <div style={{ padding: 8 }}>
        <input
          ref={inputRef}
          value={query}
          placeholder="Find or name a group…"
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            background: "var(--ae-bg-elevated)",
            border: "1px solid var(--ae-border)",
            borderRadius: 4,
            padding: "4px 8px",
            color: "var(--ae-text-primary)",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {filtered.map((group, index) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onPick(group.id)}
            onMouseEnter={() => setCursor(index)}
            style={rowStyle(cursor === index)}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: group.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.name}
            </span>
            <span style={{ fontSize: 10, color: "var(--ae-text-muted)" }}>{memberCounts.get(group.id) ?? 0}</span>
          </button>
        ))}
        {showCreate && (
          <button
            type="button"
            onClick={() => onCreate(trimmed)}
            onMouseEnter={() => setCursor(filtered.length)}
            style={rowStyle(cursor === filtered.length)}
          >
            <span style={{ color: "var(--ae-accent)" }}>+</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              New group “{trimmed}”
            </span>
          </button>
        )}
        {totalRows === 0 && (
          <div style={{ padding: "6px 10px 10px", fontSize: 11, color: "var(--ae-text-muted)" }}>
            Type a name to make the first group.
          </div>
        )}
      </div>
      {canRemove && (
        <div style={{ borderTop: "1px solid var(--ae-border)", padding: 6 }}>
          <button type="button" onClick={onRemove} style={{ ...rowStyle(false), color: "var(--ae-danger)" }}>
            Remove from group
          </button>
        </div>
      )}
    </div>
  );
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 10px",
    background: active ? "var(--ae-bg-elevated)" : "transparent",
    border: "none",
    color: "var(--ae-text-primary)",
    fontSize: 12,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
