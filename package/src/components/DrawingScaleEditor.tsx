"use client";

import React, { useState } from "react";
import type { DrawingScale } from "../utils/drawingScale";
import {
  editFormToScale,
  scaleToEditForm,
  type ScaleEditForm,
  type ScaleSideUnit,
} from "../utils/drawingScale";
import { zoomBtnStyle } from "./canvasConstants";

interface Props {
  initialScale?: DrawingScale | undefined;
  onConfirm: (scale: DrawingScale) => void;
  onCancel: () => void;
}

const PAPER_UNITS: ScaleSideUnit[] = ["in", "mm", "cm", "m", "ft"];
const REAL_UNITS: ScaleSideUnit[] = ["in", "ft", "mm", "cm", "m"];

const fieldStyle: React.CSSProperties = {
  height: 18,
  background: "var(--ae-bg-elevated)",
  border: "1px solid var(--ae-border)",
  borderRadius: 3,
  color: "var(--ae-text-primary)",
  fontSize: 11,
  padding: "0 4px",
  fontFamily: "'JetBrains Mono','Fira Code',monospace",
  outline: "none",
};

export function DrawingScaleEditor({ initialScale, onConfirm, onCancel }: Props) {
  const [form, setForm] = useState<ScaleEditForm>(() => scaleToEditForm(initialScale));
  const [error, setError] = useState<string | null>(null);

  const patch = (partial: Partial<ScaleEditForm>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setError(null);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = editFormToScale(form);
    if (!next) {
      setError("Enter valid amounts on both sides.");
      return;
    }
    onConfirm(next);
  };

  return (
    <form
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
        borderLeft: "1px solid var(--ae-border)",
        paddingLeft: 8,
        maxWidth: 420,
      }}
      onSubmit={submit}
    >
      <span style={{ color: "var(--ae-text-muted)", fontSize: 11, flexShrink: 0 }}>Scale</span>

      {/* Paper side */}
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        title="Paper amount (fractions allowed, e.g. 1/4)"
        value={form.paperAmount}
        onChange={(e) => patch({ paperAmount: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="1/4"
        style={{ ...fieldStyle, width: 44, borderColor: "var(--ae-accent)" }}
      />
      <select
        value={form.paperUnit}
        onChange={(e) => patch({ paperUnit: e.target.value as ScaleSideUnit })}
        title="Paper unit"
        style={{ ...fieldStyle, cursor: "pointer" }}
      >
        {PAPER_UNITS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      <span style={{ color: "var(--ae-text-muted)", fontSize: 11, flexShrink: 0 }}>=</span>

      {/* Real side */}
      <input
        type="text"
        inputMode="decimal"
        title="Real-world amount"
        value={form.realAmount}
        onChange={(e) => patch({ realAmount: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="1"
        style={{ ...fieldStyle, width: 44 }}
      />
      {form.realUnit === "ft" && (
        <input
          type="text"
          inputMode="decimal"
          title="Inches"
          value={form.realInches}
          onChange={(e) => patch({ realInches: e.target.value })}
          placeholder="0"
          style={{ ...fieldStyle, width: 32 }}
        />
      )}
      <select
        value={form.realUnit}
        onChange={(e) => {
          const realUnit = e.target.value as ScaleSideUnit;
          patch({
            realUnit,
            realInches: realUnit === "ft" ? form.realInches || "0" : "0",
          });
        }}
        title="Real unit"
        style={{ ...fieldStyle, cursor: "pointer" }}
      >
        {REAL_UNITS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      {error && (
        <span style={{ fontSize: 10, color: "var(--ae-danger)", flexBasis: "100%" }}>{error}</span>
      )}

      <button
        type="submit"
        title="Apply scale"
        style={{ ...zoomBtnStyle, width: 18, height: 18, color: "var(--ae-success)" }}
        onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 8 6 12 14 4" />
        </svg>
      </button>
      <button
        type="button"
        title="Cancel"
        onClick={onCancel}
        style={{ ...zoomBtnStyle, width: 18, height: 18, color: "var(--ae-danger)" }}
        onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--ae-bg-elevated)"; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="2" y1="2" x2="14" y2="14" />
          <line x1="14" y1="2" x2="2" y2="14" />
        </svg>
      </button>
    </form>
  );
}
