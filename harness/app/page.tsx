"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type {
  CanonicalAnnotation,
  ThemeVars,
} from "@ahmadtanveer44/neura-annotation-canvas";
import { labelRegistry } from "../fixtures/label-registry";
import { adaptEngineA } from "../lib/adapters";
import { adaptEngineB } from "../lib/adapters";
import { adaptEngineC } from "../lib/adapters";
import { adaptEngineD } from "../lib/adapters";
import engineA from "../fixtures/engine-a.json";
import engineB from "../fixtures/engine-b.json";
import engineC from "../fixtures/engine-c.json";
import engineD from "../fixtures/engine-d.json";

const AnnotationCanvas = dynamic(
  () =>
    import("@ahmadtanveer44/neura-annotation-canvas").then(
      (m) => m.AnnotationCanvas,
    ),
  { ssr: false },
);

const FLOOR_PLAN_URL = "/construction_drawing.png";

// Light / white theme for the harness
const lightTheme: Partial<ThemeVars> = {
  bgBase: "#f5f5f5",
  bgSurface: "#ffffff",
  bgElevated: "#f0f0f0",
  bgCanvas: "#e8e8e8",
  border: "#e0e0e0",
  borderSubtle: "#ebebeb",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textMuted: "#b0b0b0",
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  danger: "#ef4444",
  success: "#22c55e",
  handleFill: "#ffffff",
  selection: "rgba(37,99,235,0.12)",
};

type Engine = "A" | "B" | "C" | "D";

function getAnnotations(engine: Engine): CanonicalAnnotation[] {
  switch (engine) {
    case "A":
      return adaptEngineA(engineA as Parameters<typeof adaptEngineA>[0]);
    case "B":
      return adaptEngineB(engineB as Parameters<typeof adaptEngineB>[0]);
    case "C":
      return adaptEngineC(engineC as Parameters<typeof adaptEngineC>[0]);
    case "D":
      return adaptEngineD(engineD as Parameters<typeof adaptEngineD>[0]);
  }
}

export default function Page() {
  const [engine, setEngine] = useState<Engine>("A");
  const [labels, setLabels] = useState(labelRegistry);
  const annotations = getAnnotations(engine);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: lightTheme.bgBase,
        fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
      }}
    >
      {/* Harness toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 16px",
          height: 44,
          background: lightTheme.bgSurface,
          borderBottom: `1px solid ${lightTheme.border}`,
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo mark */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: lightTheme.textPrimary,
            letterSpacing: "0.02em",
            marginRight: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: lightTheme.accent,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          neura
          <span style={{ color: lightTheme.accent }}>·</span>
          annotation
        </span>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 18,
            background: lightTheme.border,
            marginRight: 8,
          }}
        />

        <span
          style={{
            fontSize: 11,
            color: lightTheme.textSecondary,
            marginRight: 4,
          }}
        >
          Engine fixture:
        </span>

        {(["A", "B", "C", "D"] as Engine[]).map((e) => (
          <button
            key={e}
            onClick={() => setEngine(e)}
            style={{
              padding: "4px 12px",
              background: engine === e ? lightTheme.accent : "transparent",
              color: engine === e ? "#ffffff" : lightTheme.textSecondary,
              border: `1px solid ${engine === e ? lightTheme.accent! : lightTheme.border!}`,
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "system-ui",
              fontWeight: engine === e ? 600 : 400,
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
          >
            Engine {e}
          </button>
        ))}

        {/* Feature hints */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: lightTheme.textMuted }}>
            <kbd style={kbdStyle}>B</kbd> bbox &nbsp;
            <kbd style={kbdStyle}>C</kbd> circle &nbsp;
            <kbd style={kbdStyle}>P</kbd> polygon
          </span>
          <span style={{ fontSize: 11, color: lightTheme.textMuted }}>
            <kbd style={kbdStyle}>Ctrl+A</kbd> select all
          </span>
          <span style={{ fontSize: 11, color: lightTheme.textMuted }}>
            <kbd style={kbdStyle}>Ctrl+Z</kbd> undo
          </span>
          <span style={{ fontSize: 11, color: lightTheme.textMuted }}>
            <kbd style={kbdStyle}>Ctrl+S</kbd> save
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <AnnotationCanvas
          key={engine}
          image={FLOOR_PLAN_URL}
          labels={labels}
          annotations={annotations}
          theme={lightTheme}
          showZoomControls={true}
          showUndoRedo={true}
          enableSelectAll={true}
          onSave={(saved) => {
            console.log("[annotation-engine] onSave", saved);
          }}
          onChange={(all) => {
            console.log("[annotation-engine] onChange count:", all.length);
          }}
          onLabelsChange={(updated) => {
            setLabels(updated);
            console.log("[annotation-engine] onLabelsChange", updated);
          }}
        />
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  background: "#f0f0f0",
  border: "1px solid #d0d0d0",
  borderRadius: 3,
  fontSize: 10,
  fontFamily: "monospace",
  color: "#444",
};
