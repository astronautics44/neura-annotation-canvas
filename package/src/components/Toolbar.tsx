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
  width?: number;
  showUndoRedo?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

type ButtonDef = { id: string; label: string; shortcut: string; icon: React.ReactNode };

const TOOL_META: Record<ToolType, ButtonDef> = {
    select: {
    id: "select", label: "Select", shortcut: "V — drag box to multi-select",
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
  polyline: {
    id: "polyline", label: "Polyline", shortcut: "Y, Enter to finish",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 8 8 13 14 20 6"/><circle cx="4" cy="17" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="14" r="1.5"/><circle cx="20" cy="6" r="1.5"/></svg>,
  },
  line: {
    id: "line", label: "Line", shortcut: "L",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  },
  point: {
    id: "point", label: "Point", shortcut: "N",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>,
  },
  circle: {
    id: "circle", label: "Circle", shortcut: "C",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>,
  },
  count: {
    id: "count", label: "Count", shortcut: "T, Enter to finish",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="12" cy="12" r="2"/></svg>,
  },
  comment: {
    id: "comment", label: "Comment", shortcut: "M — click a shape to attach",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  },
};

const HAND_BTN: ButtonDef = {
  id: "hand", label: "Hand", shortcut: "H",
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>,
};

const UNDO_BTN: ButtonDef = {
  id: "undo", label: "Undo", shortcut: "Ctrl+Z",
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13C5.4 7.4 12 5 17 8.5s6 10.8 0 14.5"/></svg>,
};

const REDO_BTN: ButtonDef = {
  id: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z",
  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13C18.6 7.4 12 5 7 8.5S1 19.3 7 23"/></svg>,
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
          background: isActive ? "var(--ae-accent)" : "transparent",
          border: "none", borderRadius: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          color: disabled ? "var(--ae-text-muted)" : isActive ? "#ffffff" : "var(--ae-text-secondary)",
          transition: "background 0.1s, color 0.1s",
        }}
        onMouseOver={(e) => { if (!isActive && !disabled) { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ae-text-primary)"; } }}
        onMouseOut={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = disabled ? "var(--ae-text-muted)" : "var(--ae-text-secondary)"; } }}
      >
        {def.icon}
      </button>
      {tooltip === def.id && (
        <div style={{ position: "absolute", left: 44, top: "50%", transform: "translateY(-50%)", background: "var(--ae-bg-elevated)", border: "1px solid var(--ae-border)", borderRadius: 4, padding: "4px 8px", whiteSpace: "nowrap", fontSize: 12, color: "var(--ae-text-primary)", pointerEvents: "none", zIndex: 1000 }}>
          {def.label} <span style={{ color: "var(--ae-text-secondary)", fontFamily: "monospace" }}>[{def.shortcut}]</span>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 24, height: 1, background: "var(--ae-border)", margin: "4px 0" }} />;
}

export function Toolbar({
  tools,
  activeTool,
  panMode,
  onToolChange,
  onPanModeChange,
  readonly,
  width = 48,
  showUndoRedo = true,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div style={{ width, background: "var(--ae-bg-surface)", borderRight: "1px solid var(--ae-border)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 4, flexShrink: 0 }}>
      {tools.map((t) => (
        <ToolButton
          key={t}
          def={TOOL_META[t]}
          isActive={activeTool === t && !panMode}
          disabled={readonly && t !== "select" && t !== "comment"}
          tooltip={tooltip}
          onMouseEnter={() => setTooltip(t)}
          onMouseLeave={() => setTooltip(null)}
          onClick={() => onToolChange(t)}
        />
      ))}

      <Divider />

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

      {showUndoRedo && (
        <>
          <Divider />
          <ToolButton
            def={UNDO_BTN}
            isActive={false}
            disabled={!canUndo}
            tooltip={tooltip}
            onMouseEnter={() => setTooltip("undo")}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onUndo?.()}
          />
          <ToolButton
            def={REDO_BTN}
            isActive={false}
            disabled={!canRedo}
            tooltip={tooltip}
            onMouseEnter={() => setTooltip("redo")}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onRedo?.()}
          />
        </>
      )}
    </div>
  );
}
