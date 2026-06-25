"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type {
  CanonicalAnnotation,
  ThemeVars,
  DrawingScale,
} from "@astronautics44/neura-annotation-canvas";
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
    import("@astronautics44/neura-annotation-canvas").then(
      (m) => m.AnnotationCanvas,
    ),
  { ssr: false },
);

// Sheet A-200A "ADMIN ELEVATIONS" rendered at 300 DPI → 10800×7200 px (36"×24" ARCH-D sheet)
const FLOOR_PLAN_URL = "/admin-elevations-p5.png";

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

// Preset scales — A-200A sheet (300 DPI) + generic fallbacks
// Imperial value = real-in per paper-in. paper/real fields enable round-trip editing.
const SCALE_PRESETS: { label: string; scale: DrawingScale; dpi: number }[] = [
  { label: "None", scale: { value: 1, unit: "mm", label: "—" }, dpi: 0 },
  // Title block reads 1/8"=1'-0" → 1 paper-in = 8 real-ft = 96 real-in
  { label: 'A-200A  1/8"=1\'-0" (title block) @ 300 DPI',
    scale: { value: 96, unit: "in", label: '1/8"=1\'', paper: { amount: "1/8", unit: "in" }, real: { amount: "1", unit: "ft", inches: "0" } }, dpi: 300 },
  // Cross-checked against datum lines (134'→150' = 16 ft over ~545 px)
  { label: 'A-200A  1"=8.8\' (measured) @ 300 DPI',
    scale: { value: 105.6, unit: "in", label: '1"=8.8\'', paper: { amount: "1", unit: "in" }, real: { amount: "8.8", unit: "ft", inches: "0" } }, dpi: 300 },
  { label: "1:100 @ 300 DPI",
    scale: { value: 100, unit: "mm", label: "1:100", paper: { amount: "1", unit: "mm" }, real: { amount: "100", unit: "mm" } }, dpi: 300 },
  { label: '1/4"=1\' @ 300 DPI',
    scale: { value: 48, unit: "in", label: '1/4"=1\'', paper: { amount: "1/4", unit: "in" }, real: { amount: "1", unit: "ft", inches: "0" } }, dpi: 300 },
];

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
  const [scalePreset, setScalePreset] = useState(1); // default: A-200A title block scale
  const activePreset = SCALE_PRESETS[scalePreset]!;
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

        {/* Scale preset selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderLeft: `1px solid ${lightTheme.border}`, paddingLeft: 12 }}>
          <span style={{ fontSize: 11, color: lightTheme.textSecondary }}>Scale:</span>
          <select
            value={scalePreset}
            onChange={(e) => setScalePreset(Number(e.target.value))}
            style={{ height: 24, background: lightTheme.bgSurface, border: `1px solid ${lightTheme.border}`, borderRadius: 4, color: lightTheme.textPrimary, fontSize: 11, padding: "0 6px", cursor: "pointer" }}
          >
            {SCALE_PRESETS.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Feature hints */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: lightTheme.textMuted }}>
            <kbd style={kbdStyle}>B</kbd> bbox &nbsp;
            <kbd style={kbdStyle}>C</kbd> circle &nbsp;
            <kbd style={kbdStyle}>P</kbd> polygon &nbsp;
            <kbd style={kbdStyle}>Y</kbd> polyline
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
          dpi={activePreset.dpi > 0 ? activePreset.dpi : undefined}
          drawingScale={activePreset.dpi > 0 ? activePreset.scale : undefined}
          onDrawingScaleChange={(s) => console.log("[annotation-engine] onDrawingScaleChange", s)}
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
