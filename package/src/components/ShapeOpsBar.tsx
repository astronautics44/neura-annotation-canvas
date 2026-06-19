"use client";

import React from "react";

interface Props {
  count: number;
  areaCount: number;
  canLayer: boolean;
  readonly: boolean;
  onMerge: () => void;
  onSubtract: () => void;
  onIntersect: () => void;
  onHollow: () => void;
  onToggleFill: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  isHollow: boolean;
  isFrame: boolean;
  allowFrame: boolean;
}

function OpButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: 11,
        borderRadius: 4,
        border: "1px solid var(--ae-border)",
        background: disabled ? "transparent" : "var(--ae-bg-elevated)",
        color: disabled ? "var(--ae-text-muted)" : "var(--ae-text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function ShapeOpsBar({
  count,
  areaCount,
  canLayer,
  readonly,
  onMerge,
  onSubtract,
  onIntersect,
  onHollow,
  onToggleFill,
  onBringForward,
  onSendBackward,
  isHollow,
  isFrame,
  allowFrame,
}: Props) {
  if (count === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background: "var(--ae-bg-surface)",
        border: "1px solid var(--ae-border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
    >
      <span style={{ fontSize: 10, color: "var(--ae-text-secondary)", marginRight: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {count} selected
      </span>

      {areaCount >= 2 && (
        <>
          <OpButton label="Merge" title="Union overlapping shapes (Ctrl+Shift+U)" disabled={readonly} onClick={onMerge} />
          <OpButton label="Subtract" title="Remove other shapes from the first selected (Ctrl+Shift+-)" disabled={readonly} onClick={onSubtract} />
          <OpButton label="Intersect" title="Keep only the overlapping region (Ctrl+Shift+I)" disabled={readonly} onClick={onIntersect} />
          <OpButton label="Cut hole" title="Cut smaller shape out of larger — donut (Ctrl+Shift+H)" disabled={readonly || areaCount !== 2} onClick={onHollow} />
        </>
      )}

      {count === 1 && (() => {
        let label = "Hollow";
        let title = "Set to Hollow (transparent fill, outline only) (Ctrl+Shift+O)";
        if (isHollow) {
          label = allowFrame ? "Frame Fill" : "Fill on";
          title = allowFrame ? "Set to Frame Fill (border filled, center empty) (Ctrl+Shift+O)" : "Set to Solid Fill (Ctrl+Shift+O)";
        } else if (isFrame) {
          label = "Fill on";
          title = "Set to Solid Fill (Ctrl+Shift+O)";
        }
        return (
          <OpButton
            label={label}
            title={title}
            disabled={readonly || areaCount !== 1}
            onClick={onToggleFill}
          />
        );
      })()}

      {canLayer && (
        <>
          <div style={{ width: 1, height: 18, background: "var(--ae-border)" }} />
          <OpButton label="↑ Layer" title="Bring forward" disabled={readonly} onClick={onBringForward} />
          <OpButton label="↓ Layer" title="Send backward" disabled={readonly} onClick={onSendBackward} />
        </>
      )}
    </div>
  );
}
