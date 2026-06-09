"use client";

import React, { useState } from "react";
import type { ToolType } from "../types/canonical";

interface Props {
  tools: ToolType[];
  activeTool: ToolType;
  panMode: boolean;
  onToolChange: (tool: ToolType) => void;
  onPanModeChange: (on: boolean) => void;
  readonly: boolean;
}

type ButtonDef = { id: string; label: string; shortcut: string; icon: React.ReactNode };

const TOOL_META: Record<ToolType, ButtonDef> = {
  select: {
    id: "select", label: "Select", shortcut: "V",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>,
  },
  bbox: {
    id: "bbox", label: "BBox", shortcut: "B",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  },
  polygon: {
    id: "polygon", label: "Polygon", shortcut: "P",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 8 L17 19 L7 19 L4 8 Z"/></svg>,
  },
  line: {
    id: "line", label: "Line", shortcut: "L",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  },
  point: {
    id: "point", label: "Point", shortcut: "N",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>,
  },
};

const HAND_BTN: ButtonDef = {
  id: "hand", label: "Hand", shortcut: "H",
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>,
};

function ToolButton({ def, isActive, disabled, tooltip, onMouseEnter, onMouseLeave, onClick }: {
  def: ButtonDef;
  isActive: boolean;
  disabled: boolean;
  tooltip: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isActive ? "#2563eb" : "transparent",
          border: "none", borderRadius: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          color: disabled ? "#555555" : isActive ? "#ffffff" : "#8a8a8a",
          transition: "background 0.1s, color 0.1s",
        }}
        onMouseOver={(e) => { if (!isActive && !disabled) { (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#e8e8e8"; } }}
        onMouseOut={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = disabled ? "#555555" : "#8a8a8a"; } }}
      >
        {def.icon}
      </button>
      {tooltip === def.id && (
        <div style={{ position: "absolute", left: 44, top: "50%", transform: "translateY(-50%)", background: "#2a2a2a", border: "1px solid #333333", borderRadius: 4, padding: "4px 8px", whiteSpace: "nowrap", fontSize: 12, color: "#e8e8e8", pointerEvents: "none", zIndex: 1000 }}>
          {def.label} <span style={{ color: "#8a8a8a", fontFamily: "monospace" }}>[{def.shortcut}]</span>
        </div>
      )}
    </div>
  );
}

export function Toolbar({ tools, activeTool, panMode, onToolChange, onPanModeChange, readonly }: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div style={{ width: 48, background: "#1e1e1e", borderRight: "1px solid #333333", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 4, flexShrink: 0 }}>
      {tools.map((t) => (
        <ToolButton
          key={t}
          def={TOOL_META[t]}
          isActive={activeTool === t && !panMode}
          disabled={readonly && t !== "select"}
          tooltip={tooltip}
          onMouseEnter={() => setTooltip(t)}
          onMouseLeave={() => setTooltip(null)}
          onClick={() => onToolChange(t)}
        />
      ))}

      {/* Divider */}
      <div style={{ width: 24, height: 1, background: "#333333", margin: "4px 0" }} />

      {/* Hand tool */}
      <ToolButton
        def={HAND_BTN}
        isActive={panMode}
        disabled={false}
        tooltip={tooltip}
        onMouseEnter={() => setTooltip("hand")}
        onMouseLeave={() => setTooltip(null)}
        onClick={() => onPanModeChange(!panMode)}
      />
    </div>
  );
}
