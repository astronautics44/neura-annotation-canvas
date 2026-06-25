import type { DrawingScaleUnit } from "./dimensions";

export type ScaleSideUnit = "in" | "mm" | "cm" | "m" | "ft";

export interface ScaleSideInput {
  /** Numeric string; fractions allowed on paper side, e.g. `"1/4"`. */
  amount: string;
  unit: ScaleSideUnit;
  /** Supplemental inches when `unit` is `"ft"`, e.g. `"0"` for 1'-0". */
  inches?: string;
}

export interface DrawingScale {
  /** Real units per 1 paper unit (paper inch for imperial, paper mm for metric). */
  value: number;
  unit: DrawingScaleUnit;
  /** Human-readable notation, e.g. `1/4"=1'-0"` or `1:100`. */
  label: string;
  /** Persisted editor sides for round-trip editing. */
  paper?: ScaleSideInput;
  real?: ScaleSideInput;
}

export interface ScaleEditForm {
  paperAmount: string;
  paperUnit: ScaleSideUnit;
  realAmount: string;
  realUnit: ScaleSideUnit;
  realInches: string;
}

export function parseScaleAmount(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
    const v = num / den;
    return v > 0 ? v : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sideToInches(amount: number, unit: ScaleSideUnit, extraInches = 0): number {
  switch (unit) {
    case "in":
      return amount;
    case "ft":
      return amount * 12 + extraInches;
    case "mm":
      return amount / 25.4;
    case "cm":
      return amount / 2.54;
    case "m":
      return amount * 39.3700787;
  }
}

function sideToMm(amount: number, unit: ScaleSideUnit, extraInches = 0): number {
  switch (unit) {
    case "mm":
      return amount;
    case "cm":
      return amount * 10;
    case "m":
      return amount * 1000;
    case "in":
      return amount * 25.4;
    case "ft":
      return (amount * 12 + extraInches) * 25.4;
  }
}

function formatPaperLabel(side: ScaleSideInput): string {
  if (side.unit === "in") return `${side.amount.trim()}"`;
  if (side.unit === "ft") {
    const inch = side.inches?.trim() || "0";
    return `${side.amount.trim()}'-${inch}"`;
  }
  return `${side.amount.trim()}${side.unit}`;
}

function formatRealLabel(side: ScaleSideInput): string {
  if (side.unit === "ft") {
    const inch = side.inches?.trim() || "0";
    return `${side.amount.trim()}'-${inch}"`;
  }
  if (side.unit === "in") return `${side.amount.trim()}${side.unit}`;
  return `${side.amount.trim()}${side.unit}`;
}

function isImperialScale(paper: ScaleSideInput, real: ScaleSideInput): boolean {
  return (
    paper.unit === "in" ||
    paper.unit === "ft" ||
    real.unit === "in" ||
    real.unit === "ft"
  );
}

export function buildDrawingScale(
  paper: ScaleSideInput,
  real: ScaleSideInput,
): DrawingScale | null {
  const p = parseScaleAmount(paper.amount);
  const r = parseScaleAmount(real.amount);
  if (p === null || r === null) return null;

  const extraIn = real.unit === "ft" ? parseScaleAmount(real.inches ?? "0") ?? 0 : 0;
  if (extraIn < 0) return null;

  const paperIn = sideToInches(p, paper.unit);
  const realIn = sideToInches(r, real.unit, extraIn);
  if (paperIn <= 0 || realIn <= 0) return null;

  const paperNorm: ScaleSideInput = {
    amount: paper.amount.trim(),
    unit: paper.unit,
    ...(paper.inches !== undefined ? { inches: paper.inches.trim() } : {}),
  };
  const realNorm: ScaleSideInput = {
    amount: real.amount.trim(),
    unit: real.unit,
    ...(real.unit === "ft" ? { inches: (real.inches ?? "0").trim() } : {}),
  };

  // Metric ratio shorthand: 1 mm on paper = N mm real → label `1:100`
  if (
    !isImperialScale(paperNorm, realNorm) &&
    paperNorm.unit === "mm" &&
    paperNorm.amount === "1" &&
    realNorm.unit === "mm"
  ) {
    const ratio = sideToMm(r, real.unit, extraIn) / sideToMm(p, paper.unit);
    return {
      value: ratio,
      unit: "mm",
      label: `1:${trimTrailingZeros(ratio)}`,
      paper: paperNorm,
      real: realNorm,
    };
  }

  const label = `${formatPaperLabel(paperNorm)}=${formatRealLabel(realNorm)}`;

  if (isImperialScale(paperNorm, realNorm)) {
    return {
      value: realIn / paperIn,
      unit: "in",
      label,
      paper: paperNorm,
      real: realNorm,
    };
  }

  const paperMm = sideToMm(p, paper.unit);
  const realMm = sideToMm(r, real.unit, extraIn);
  const displayUnit: DrawingScaleUnit =
    real.unit === "m" ? "m" : real.unit === "cm" ? "cm" : "mm";

  return {
    value: realMm / paperMm,
    unit: displayUnit,
    label,
    paper: paperNorm,
    real: realNorm,
  };
}

function trimTrailingZeros(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export function scaleToEditForm(scale?: DrawingScale): ScaleEditForm {
  if (scale?.paper && scale?.real) {
    return {
      paperAmount: scale.paper.amount,
      paperUnit: scale.paper.unit,
      realAmount: scale.real.amount,
      realUnit: scale.real.unit,
      realInches: scale.real.inches ?? "0",
    };
  }

  if (scale) {
    const ratioLabel = /^1:(\d+(?:\.\d+)?)$/.exec(scale.label.trim());
    if (ratioLabel) {
      return {
        paperAmount: "1",
        paperUnit: "mm",
        realAmount: ratioLabel[1]!,
        realUnit: "mm",
        realInches: "0",
      };
    }

    const arch = /^(.+?)"=(\d+(?:\.\d+)?)'-(\d+(?:\.\d+)?)"$/.exec(scale.label.trim());
    if (arch) {
      return {
        paperAmount: arch[1]!,
        paperUnit: "in",
        realAmount: arch[2]!,
        realUnit: "ft",
        realInches: arch[3]!,
      };
    }

    const archShort = /^(.+?)"=(\d+(?:\.\d+)?)'$/.exec(scale.label.trim());
    if (archShort) {
      return {
        paperAmount: archShort[1]!,
        paperUnit: "in",
        realAmount: archShort[2]!,
        realUnit: "ft",
        realInches: "0",
      };
    }

    if (scale.unit === "in" || scale.unit === "ft") {
      if (Math.abs(scale.value - 48) < 0.001) {
        return {
          paperAmount: "1/4",
          paperUnit: "in",
          realAmount: "1",
          realUnit: "ft",
          realInches: "0",
        };
      }
      return {
        paperAmount: "1",
        paperUnit: "in",
        realAmount: trimTrailingZeros(scale.value),
        realUnit: "in",
        realInches: "0",
      };
    }

    return {
      paperAmount: "1",
      paperUnit: "mm",
      realAmount: trimTrailingZeros(scale.value),
      realUnit: scale.unit,
      realInches: "0",
    };
  }

  return {
    paperAmount: "1",
    paperUnit: "mm",
    realAmount: "100",
    realUnit: "mm",
    realInches: "0",
  };
}

export function editFormToScale(form: ScaleEditForm): DrawingScale | null {
  return buildDrawingScale(
    { amount: form.paperAmount, unit: form.paperUnit },
    {
      amount: form.realAmount,
      unit: form.realUnit,
      ...(form.realUnit === "ft" ? { inches: form.realInches } : {}),
    },
  );
}
