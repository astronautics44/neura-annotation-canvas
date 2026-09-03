import type { CanonicalAnnotation } from "@astronautics44/neura-annotation-canvas";

/**
 * A synthetic engine result sized like a real takeoff: a few hundred count
 * marks, a few dozen boxes and a handful of areas over the 10800×7200 sheet.
 *
 * It exists to measure the canvas rather than to look like a drawing. The
 * three real fixtures carry a dozen shapes each, which is enough to check that
 * an adapter works and nowhere near enough to notice that a viewport change
 * re-renders every shape. Deterministic, so two runs measure the same thing.
 */
const SHEET = { width: 10800, height: 7200 };
const POINTS = 400;
const BOXES = 40;
const AREAS = 10;

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function stressAnnotations(): CanonicalAnnotation[] {
  const random = seeded(7);
  const at = (): [number, number] => [random() * SHEET.width, random() * SHEET.height];
  const out: CanonicalAnnotation[] = [];

  for (let i = 0; i < POINTS; i++) {
    out.push({ id: `stress-point-${i}`, type: "point", label: "column", points: [at()], source: "engine", confidence: 0.5 + random() / 2 });
  }
  for (let i = 0; i < BOXES; i++) {
    const [x, y] = at();
    const w = 120 + random() * 400;
    const h = 120 + random() * 400;
    out.push({ id: `stress-box-${i}`, type: "bbox", label: "door", points: [[x, y], [x + w, y + h]], source: "engine", confidence: 0.5 + random() / 2 });
  }
  for (let i = 0; i < AREAS; i++) {
    const [x, y] = at();
    const r = 300 + random() * 600;
    const sides = 5 + Math.floor(random() * 4);
    const ring: [number, number][] = Array.from({ length: sides }, (_, k) => {
      const angle = (k / sides) * Math.PI * 2;
      return [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
    });
    out.push({ id: `stress-area-${i}`, type: "polygon", label: "room", points: ring, source: "engine", confidence: 0.5 + random() / 2 });
  }
  return out;
}
