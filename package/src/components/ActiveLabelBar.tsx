"use client";

import React from "react";
import type { LabelMap } from "../types/canonical";

interface Props {
  /** Currently pinned label, if any. */
  active: LabelMap | undefined;
  /** Whether the label picker dropdown is open. */
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}

/**
 * Floating indicator for the pinned annotation class. While a class is pinned,
 * every shape the user draws is committed with that label — the label popover
 * never opens.
 */
export function ActiveLabelBar({ active, open, onToggle, onClear }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 6px 5px 10px",
        background: "var(--ae-bg-surface)",
        border: `1px solid ${active ? "var(--ae-accent)" : "var(--ae-border)"}`,
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--ae-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Class
      </span>

      <button
        type="button"
        onClick={onToggle}
        title={
          active
            ? `Drawing as "${active.displayName}" — click to change`
            : "Pin a class so new shapes skip the label prompt"
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          fontSize: 12,
          borderRadius: 4,
          border: "1px solid var(--ae-border)",
          background: open ? "var(--ae-bg-elevated)" : "transparent",
          color: active ? "var(--ae-text-primary)" : "var(--ae-text-muted)",
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {active && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: active.color,
              flexShrink: 0,
            }}
          />
        )}
        {active ? active.displayName : "Ask every time"}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {active && (
        <button
          type="button"
          onClick={onClear}
          title="Unpin class — go back to asking for a label (0)"
          style={{
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            border: "none",
            borderRadius: 4,
            background: "transparent",
            color: "var(--ae-text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
