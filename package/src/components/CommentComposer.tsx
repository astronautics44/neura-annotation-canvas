"use client";

import React, { useEffect, useRef, useState } from "react";

interface Props {
  position: { x: number; y: number };
  /** Short description of what the comment lands on, e.g. "Door" or "drawing". */
  targetLabel: string;
  /** Dot colour for an attached comment. Omitted for a free-form pin. */
  targetColor?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

const WIDTH = 244;

/**
 * The in-canvas comment box.
 *
 * Deliberately the whole of the package's comment *content* surface: one text
 * box to start a thread. Reading a thread, replying to it and resolving it are
 * the consumer's — the canvas shows a marker and says which thread it is.
 */
export function CommentComposer({ position, targetLabel, targetColor, onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // The click or keystroke that opened this box is still in flight, and the
    // canvas takes focus back when it finishes — so claim it again after.
    const id = window.setTimeout(() => el.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Clicking away is a cancel, matching the label popover. Armed on the next
  // tick: the mousedown that opened this box is still propagating to document,
  // and would otherwise close it the instant it appeared.
  useEffect(() => {
    let armed = false;
    const arm = window.setTimeout(() => { armed = true; }, 0);
    const onDown = (e: MouseEvent) => {
      if (!armed) return;
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onCancel]);

  const submit = () => {
    const body = text.trim();
    if (body) onSubmit(body);
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "absolute",
        left: Math.min(position.x + 12, window.innerWidth - WIDTH - 10),
        top: Math.max(position.y - 12, 8),
        width: WIDTH,
        background: "var(--ae-bg-surface)",
        border: "1px solid var(--ae-border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "1px solid var(--ae-border-subtle)" }}>
        {targetColor && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: targetColor, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 11, color: "var(--ae-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Comment on {targetLabel}
        </span>
      </div>

      <div style={{ padding: "8px 10px" }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Keystrokes must not reach the canvas' window-level shortcuts, or
          // typing "b" would switch to the bbox tool mid-sentence.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
          placeholder="Write a comment…"
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--ae-bg-elevated)",
            border: "1px solid var(--ae-border)",
            borderRadius: 4,
            padding: "6px 8px",
            color: "var(--ae-text-primary)",
            fontSize: 12,
            fontFamily: "inherit",
            lineHeight: 1.45,
            resize: "vertical",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <button
            onClick={submit}
            disabled={!text.trim()}
            style={{
              padding: "4px 10px", borderRadius: 4, fontSize: 12, fontFamily: "inherit",
              border: "1px solid var(--ae-accent)",
              background: text.trim() ? "var(--ae-accent)" : "var(--ae-bg-elevated)",
              color: text.trim() ? "#ffffff" : "var(--ae-text-muted)",
              cursor: text.trim() ? "pointer" : "not-allowed",
            }}
          >
            Comment
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "4px 10px", borderRadius: 4, fontSize: 12, fontFamily: "inherit",
              border: "1px solid var(--ae-border)", background: "transparent",
              color: "var(--ae-text-secondary)", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ae-text-muted)", fontFamily: "monospace" }}>
            ⌘↵
          </span>
        </div>
      </div>
    </div>
  );
}
