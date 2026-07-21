"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LabelMap, SymbolSize, SymbolSizeUnit } from "../types/canonical";
import {
  DEFAULT_SYMBOL_SIZE_ATTRIBUTES,
  SYMBOL_SIZE_UNITS,
} from "../utils/symbolSize";

interface Props {
  labels: LabelMap[];
  position: { x: number; y: number };
  onSelect: (canonicalClassId: string, symbolSize?: SymbolSize) => void;
  onCancel: () => void;
  onCreateLabel?: ((displayName: string) => string) | undefined;
  /** Pre-fill symbol size fields when relabeling an existing annotation. */
  initialSymbolSize?: SymbolSize;
  /**
   * How `position` is interpreted. Default "absolute" positions relative to the
   * nearest positioned ancestor (used for canvas-relative popovers). "fixed"
   * treats `position` as viewport coordinates and escapes any ancestor
   * overflow:hidden clip (used by the label panel, whose scroll container would
   * otherwise clip it).
   */
  positionStrategy?: "absolute" | "fixed";
}

type Phase = "pick-label" | "symbol-size";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--ae-bg-elevated)",
  border: "1px solid var(--ae-border)",
  borderRadius: 4,
  padding: "4px 8px",
  color: "var(--ae-text-primary)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--ae-text-muted)",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export function LabelPopover({
  labels,
  position,
  onSelect,
  onCancel,
  onCreateLabel,
  initialSymbolSize,
  positionStrategy = "absolute",
}: Props) {
  const [phase, setPhase] = useState<Phase>("pick-label");
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);

  const [attributeChoice, setAttributeChoice] = useState(
    initialSymbolSize?.attribute ?? DEFAULT_SYMBOL_SIZE_ATTRIBUTES[0]!,
  );
  const [customAttribute, setCustomAttribute] = useState("");
  const [sizeValue, setSizeValue] = useState(
    initialSymbolSize?.value.toString() ?? "",
  );
  const [sizeUnit, setSizeUnit] = useState<SymbolSizeUnit>(
    initialSymbolSize?.unit ?? "mm",
  );

  const pickedLabelMap = labels.find((l) => l.canonicalClassId === pickedLabel);
  const attributeOptions =
    pickedLabelMap?.symbolSizeAttributes?.length
      ? pickedLabelMap.symbolSizeAttributes
      : [...DEFAULT_SYMBOL_SIZE_ATTRIBUTES];

  const resolvedAttribute =
    attributeChoice === "__custom__" ? customAttribute.trim() : attributeChoice;

  const filtered = labels.filter((l) =>
    l.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  const trimmed = query.trim();
  const exactMatch = labels.some(
    (l) => l.displayName.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = !!onCreateLabel && trimmed.length > 0 && !exactMatch;
  const totalRows = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (phase === "pick-label") {
      inputRef.current?.focus();
      if (labels.length === 1 && labels[0] && !onCreateLabel) {
        pickLabel(labels[0].canonicalClassId);
      }
    } else {
      valueRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const pickLabel = (canonicalClassId: string) => {
    const lm = labels.find((l) => l.canonicalClassId === canonicalClassId);
    if (lm?.symbolSize) {
      const attrs =
        lm.symbolSizeAttributes?.length
          ? lm.symbolSizeAttributes
          : [...DEFAULT_SYMBOL_SIZE_ATTRIBUTES];
      setPickedLabel(canonicalClassId);
      if (initialSymbolSize) {
        const inList = attrs.includes(initialSymbolSize.attribute);
        setAttributeChoice(inList ? initialSymbolSize.attribute : "__custom__");
        setCustomAttribute(inList ? "" : initialSymbolSize.attribute);
        setSizeValue(initialSymbolSize.value.toString());
        setSizeUnit(initialSymbolSize.unit);
      } else {
        setAttributeChoice(attrs[0] ?? DEFAULT_SYMBOL_SIZE_ATTRIBUTES[0]!);
        setCustomAttribute("");
        setSizeValue("");
        setSizeUnit("mm");
      }
      setPhase("symbol-size");
    } else {
      onSelect(canonicalClassId);
    }
  };

  const commitCursor = () => {
    if (cursor < filtered.length) {
      const item = filtered[cursor];
      if (item) pickLabel(item.canonicalClassId);
    } else if (showCreate) {
      handleCreate();
    }
  };

  const handleCreate = () => {
    if (!onCreateLabel || !trimmed) return;
    const id = onCreateLabel(trimmed);
    pickLabel(id);
  };

  const handlePickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, totalRows - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitCursor();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const buildSymbolSize = (): SymbolSize | undefined => {
    const v = parseFloat(sizeValue);
    if (!resolvedAttribute || isNaN(v) || v <= 0) return undefined;
    return { attribute: resolvedAttribute, value: v, unit: sizeUnit };
  };

  const canConfirmSymbolSize = (): boolean => {
    const v = parseFloat(sizeValue);
    return resolvedAttribute.length > 0 && !isNaN(v) && v > 0;
  };

  const confirmSymbolSize = (skip = false) => {
    if (!pickedLabel) return;
    const required = pickedLabelMap?.symbolSize === "required";
    if (skip && !required) {
      onSelect(pickedLabel);
      return;
    }
    const size = buildSymbolSize();
    if (!size) return;
    onSelect(pickedLabel, size);
  };

  const handleSymbolSizeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canConfirmSymbolSize()) confirmSymbolSize(false);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const popoverWidth = phase === "symbol-size" ? 240 : 200;

  return (
    <div
      style={{
        position: positionStrategy,
        left: Math.min(position.x, window.innerWidth - popoverWidth - 10),
        top: Math.min(position.y, window.innerHeight - 360),
        width: popoverWidth,
        background: "var(--ae-bg-surface)",
        border: "1px solid var(--ae-border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      {phase === "pick-label" && (
        <>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--ae-border-subtle)" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handlePickKeyDown}
              placeholder="Search or create label…"
              style={inputStyle}
            />
          </div>

          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 && !showCreate && (
              <div style={{ padding: "8px 12px", color: "var(--ae-text-muted)", fontSize: 12 }}>
                No results
              </div>
            )}

            {filtered.map((lm, i) => (
              <div
                key={lm.canonicalClassId}
                onClick={() => pickLabel(lm.canonicalClassId)}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  cursor: "pointer",
                  background: i === cursor ? "var(--ae-accent)" : "transparent",
                  color: i === cursor ? "#ffffff" : "var(--ae-text-primary)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: lm.color,
                    flexShrink: 0,
                  }}
                />
                {lm.displayName}
              </div>
            ))}

            {showCreate && (
              <>
                {filtered.length > 0 && (
                  <div style={{ height: 1, background: "var(--ae-border-subtle)", margin: "2px 0" }} />
                )}
                <div
                  onClick={handleCreate}
                  onMouseEnter={() => setCursor(filtered.length)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    background: cursor === filtered.length ? "var(--ae-accent)" : "transparent",
                    color: cursor === filtered.length ? "#ffffff" : "var(--ae-success)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                  Create{" "}
                  <strong style={{ marginLeft: 2 }}>&ldquo;{trimmed}&rdquo;</strong>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {phase === "symbol-size" && pickedLabelMap && (
        <div style={{ padding: "10px 12px" }} onKeyDown={handleSymbolSizeKeyDown}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: "1px solid var(--ae-border-subtle)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: pickedLabelMap.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--ae-text-primary)", fontWeight: 500 }}>
              {pickedLabelMap.displayName}
            </span>
            <button
              type="button"
              onClick={() => setPhase("pick-label")}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "var(--ae-text-muted)",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Change
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={fieldLabelStyle}>Attribute</div>
              <select
                value={
                  attributeChoice === "__custom__" ||
                  !attributeOptions.includes(attributeChoice)
                    ? "__custom__"
                    : attributeChoice
                }
                onChange={(e) => setAttributeChoice(e.target.value)}
                style={selectStyle}
              >
                {attributeOptions.map((attr) => (
                  <option key={attr} value={attr}>
                    {attr}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {(attributeChoice === "__custom__" ||
                !attributeOptions.includes(attributeChoice)) && (
                <input
                  value={customAttribute}
                  onChange={(e) => setCustomAttribute(e.target.value)}
                  placeholder="e.g. spacing"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              )}
            </div>

            <div>
              <div style={fieldLabelStyle}>Value</div>
              <input
                ref={valueRef}
                type="number"
                min="0.001"
                step="any"
                value={sizeValue}
                onChange={(e) => setSizeValue(e.target.value)}
                placeholder="e.g. 12"
                style={{
                  ...inputStyle,
                  fontFamily: "'JetBrains Mono','Fira Code',monospace",
                }}
              />
            </div>

            <div>
              <div style={fieldLabelStyle}>Unit</div>
              <select
                value={sizeUnit}
                onChange={(e) => setSizeUnit(e.target.value as SymbolSizeUnit)}
                style={selectStyle}
              >
                {SYMBOL_SIZE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button
              type="button"
              disabled={!canConfirmSymbolSize()}
              onClick={() => confirmSymbolSize(false)}
              style={{
                flex: 1,
                padding: "5px 0",
                background: canConfirmSymbolSize() ? "var(--ae-accent)" : "var(--ae-bg-elevated)",
                border: "none",
                borderRadius: 4,
                color: canConfirmSymbolSize() ? "#fff" : "var(--ae-text-muted)",
                fontSize: 12,
                cursor: canConfirmSymbolSize() ? "pointer" : "not-allowed",
              }}
            >
              Confirm
            </button>
            {pickedLabelMap.symbolSize === "optional" && (
              <button
                type="button"
                onClick={() => confirmSymbolSize(true)}
                style={{
                  padding: "5px 10px",
                  background: "transparent",
                  border: "1px solid var(--ae-border)",
                  borderRadius: 4,
                  color: "var(--ae-text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
