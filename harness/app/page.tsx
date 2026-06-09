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

const FLOOR_PLAN_URL = "/floorplan.svg";

// Ccript Agency design system — deep charcoal + warm orange
const ccriptTheme: Partial<ThemeVars> = {
  bgBase: "#0C0C0C",
  bgSurface: "#161616",
  bgElevated: "#1F1F1F",
  bgCanvas: "#080808",
  border: "#2A2A2A",
  borderSubtle: "#1A1A1A",
  textPrimary: "#F5F5F5",
  textSecondary: "#8A8A8A",
  textMuted: "#4A4A4A",
  accent: "#F97316",
  accentHover: "#EA6C0A",
  danger: "#EF4444",
  success: "#22C55E",
  handleFill: "#FFFFFF",
  selection: "rgba(249,115,22,0.15)",
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
        background: ccriptTheme.bgBase,
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
          height: 40,
          background: ccriptTheme.bgSurface,
          borderBottom: `1px solid ${ccriptTheme.border}`,
          flexShrink: 0,
        }}
      >
        {/* Logo mark */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: ccriptTheme.textPrimary,
            letterSpacing: "0.02em",
            marginRight: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: ccriptTheme.accent,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          neura
          <span style={{ color: ccriptTheme.accent }}>·</span>
          annotation
        </span>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 18,
            background: ccriptTheme.border,
            marginRight: 8,
          }}
        />

        <span
          style={{
            fontSize: 11,
            color: ccriptTheme.textSecondary,
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
              padding: "3px 12px",
              background:
                engine === e ? ccriptTheme.accent : ccriptTheme.bgElevated,
              color: engine === e ? "#ffffff" : ccriptTheme.textSecondary,
              border: `1px solid ${engine === e ? ccriptTheme.accent! : ccriptTheme.border!}`,
              borderRadius: 4,
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
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <AnnotationCanvas
          key={engine}
          image={FLOOR_PLAN_URL}
          labels={labels}
          annotations={annotations}
          theme={ccriptTheme}
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
