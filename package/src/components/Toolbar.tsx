"use client";

import React, { useState } from "react";
import type { ToolType } from "../types/canonical";

interface Props {
  tools: ToolType[];
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  readonly: boolean;
}

const TOOL_META: Record<ToolType, { label: string; shortcut: string; icon: React.ReactNode }> = {
  select: {
    label: "Select",
    shortcut: "V",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" />
      </svg>
    ),
  },
  bbox: {
    label: "BBox",
    shortcut: "B",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  polygon: {
    label: "Polygon",
    shortcut: "P",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 L20 8 L17 19 L7 19 L4 8 Z" />
      </svg>
    ),
  },
  line: {
    label: "Line",
    shortcut: "L",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  point: {
    label: "Point",
    shortcut: "N",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
};

export function Toolbar({ tools, activeTool, onToolChange, readonly }: Props) {
  const [tooltip, setTooltip] = useState<ToolType | null>(null);

  return (
    <div style={{
      width: 48,
      background: "#1e1e1e",
      borderRight: "1px solid #333333",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 8,
      gap: 4,
      flexShrink: 0,
      position: "relative",
    }}>
      {tools.map((t) => {
        const meta = TOOL_META[t];
        const isActive = activeTool === t;
        const disabled = readonly && t !== "select";
        return (
          <div key={t} style={{ position: "relative" }}>
            <button
              title=""
              disabled={disabled}
              onClick={() => !disabled && onToolChange(t)}
              onMouseEnter={() => setTooltip(t)}
              onMouseLeave={() => setTooltip(null)}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "#2563eb" : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: disabled ? "not-allowed" : "pointer",
                color: disabled ? "#555555" : isActive ? "#ffffff" : "#8a8a8a",
                transition: "background 0.1s, color 0.1s",
              }}
              onMouseOver={(e) => {
                if (!isActive && !disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a";
                  (e.currentTarget as HTMLButtonElement).style.color = "#e8e8e8";
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = disabled ? "#555555" : "#8a8a8a";
                }
              }}
            >
              {meta.icon}
            </button>
            {tooltip === t && (
              <div style={{
                position: "absolute",
                left: 44,
                top: "50%",
                transform: "translateY(-50%)",
                background: "#2a2a2a",
                border: "1px solid #333333",
                borderRadius: 4,
                padding: "4px 8px",
                whiteSpace: "nowrap",
                fontSize: 12,
                color: "#e8e8e8",
                pointerEvents: "none",
                zIndex: 1000,
              }}>
                {meta.label} <span style={{ color: "#8a8a8a", fontFamily: "monospace" }}>[{meta.shortcut}]</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
