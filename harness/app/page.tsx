"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { CanonicalAnnotation } from "@neura/annotation-engine";
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
  () => import("@neura/annotation-engine").then((m) => m.AnnotationCanvas),
  { ssr: false },
);

const FLOOR_PLAN_URL = "/floorplan.svg";

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
        background: "#141414",
      }}
    >
      {/* Fixture selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          background: "#1e1e1e",
          borderBottom: "1px solid #333333",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: "#8a8a8a", marginRight: 4 }}>
          Engine fixture:
        </span>
        {(["A", "B", "C", "D"] as Engine[]).map((e) => (
          <button
            key={e}
            onClick={() => setEngine(e)}
            style={{
              padding: "3px 12px",
              background: engine === e ? "#2563eb" : "#2a2a2a",
              color: engine === e ? "#ffffff" : "#8a8a8a",
              border: "1px solid",
              borderColor: engine === e ? "#2563eb" : "#333333",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "system-ui",
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
