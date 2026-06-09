"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LabelMap } from "../types/canonical";

interface Props {
  labels: LabelMap[];
  position: { x: number; y: number };
  onSelect: (label: string) => void;
  onCancel: () => void;
}

export function LabelPopover({ labels, position, onSelect, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = labels.filter((l) =>
    l.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
    if (labels.length === 1 && labels[0]) {
      onSelect(labels[0].canonicalClassId);
    }
  }, []);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[cursor];
      if (item) onSelect(item.canonicalClassId);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 300),
        width: 180,
        background: "#1e1e1e",
        border: "1px solid #333333",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "6px 8px", borderBottom: "1px solid #2a2a2a" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search label..."
          style={{
            width: "100%",
            background: "#2a2a2a",
            border: "1px solid #333333",
            borderRadius: 4,
            padding: "4px 8px",
            color: "#e8e8e8",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "8px 12px", color: "#555555", fontSize: 12 }}>No results</div>
        )}
        {filtered.map((lm, i) => (
          <div
            key={lm.canonicalClassId}
            onClick={() => onSelect(lm.canonicalClassId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              cursor: "pointer",
              background: i === cursor ? "#2563eb" : "transparent",
              color: i === cursor ? "#ffffff" : "#e8e8e8",
              fontSize: 13,
            }}
            onMouseEnter={() => setCursor(i)}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: lm.color, flexShrink: 0,
            }} />
            {lm.displayName}
          </div>
        ))}
      </div>
    </div>
  );
}
