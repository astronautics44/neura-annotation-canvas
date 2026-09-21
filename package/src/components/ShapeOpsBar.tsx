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
  /**
   * Change the class of everything selected. Provided only when editing is
   * allowed — the visible path to the bulk relabel, so it is not `R`-only.
   */
  onRelabel?: (() => void) | undefined;
  /**
   * Put everything selected into a group. Provided only when grouping is on and
   * editing is allowed.
   */
  onGroup?: (() => void) | undefined;
  /**
   * Mark everything selected optional, or not optional when it all already is.
   * Provided only when optional marks are on and editing is allowed.
   */
  onToggleOptional?: (() => void) | undefined;
  /** Every selected annotation is optional, so the toggle reads "Not optional". */
  allOptional?: boolean | undefined;
  /**
   * Start a comment on the selection. Provided only when commenting is on —
   * the visible path to the comment box, so it is not hotkey-only.
   */
  onComment?: (() => void) | undefined;
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
  onRelabel,
  onGroup,
  onToggleOptional,
  allOptional = false,
  onComment,
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

      {onRelabel && (
        <OpButton
          label={count > 1 ? `Change class (${count})` : "Change class"}
          title={
            count > 1
              ? `Assign one class to all ${count} selected annotations (R)`
              : "Change this annotation's class (R)"
          }
          disabled={false}
          onClick={onRelabel}
        />
      )}

      {onGroup && (
        <OpButton
          label={count > 1 ? `Group (${count})` : "Group"}
          title={
            count > 1
              ? `Put all ${count} selected annotations in one group (G)`
              : "Put this annotation in a group (G)"
          }
          disabled={false}
          onClick={onGroup}
        />
      )}

      {onToggleOptional && (
        <OpButton
          label={allOptional ? "Not optional" : count > 1 ? `Optional (${count})` : "Optional"}
          title={
            allOptional
              ? `Mark ${count > 1 ? `all ${count} selected annotations` : "this annotation"} as not optional (O)`
              : `Mark ${count > 1 ? `all ${count} selected annotations` : "this annotation"} as optional (O)`
          }
          disabled={false}
          onClick={onToggleOptional}
        />
      )}

      {onComment && (
        <>
          <OpButton
            label="Comment"
            title="Comment on the selection (M)"
            disabled={false}
            onClick={onComment}
          />
          {!readonly && <span style={{ width: 1, height: 16, background: "var(--ae-border)" }} />}
        </>
      )}

      {!readonly && areaCount >= 2 && (
        <>
          <OpButton label="Merge" title="Union overlapping shapes (Ctrl+Shift+U)" disabled={readonly} onClick={onMerge} />
          <OpButton label="Subtract" title="Remove other shapes from the first selected (Ctrl+Shift+-)" disabled={readonly} onClick={onSubtract} />
          <OpButton label="Intersect" title="Keep only the overlapping region (Ctrl+Shift+I)" disabled={readonly} onClick={onIntersect} />
          <OpButton label="Cut hole" title="Cut smaller shape out of larger — donut (Ctrl+Shift+H)" disabled={readonly || areaCount !== 2} onClick={onHollow} />
        </>
      )}

      {!readonly && count === 1 && (
        <OpButton
          label={isHollow ? "Fill on" : "Hollow"}
          title="Toggle fill — stroke-only outline (Ctrl+Shift+O)"
          disabled={readonly || areaCount !== 1}
          onClick={onToggleFill}
        />
      )}

      {!readonly && canLayer && (
        <>
          <div style={{ width: 1, height: 18, background: "var(--ae-border)" }} />
          <OpButton label="↑ Layer" title="Bring forward" disabled={readonly} onClick={onBringForward} />
          <OpButton label="↓ Layer" title="Send backward" disabled={readonly} onClick={onSendBackward} />
        </>
      )}
    </div>
  );
}
