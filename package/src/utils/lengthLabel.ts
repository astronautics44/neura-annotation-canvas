/**
 * Inches written as a drawing writes a length: rounded to the nearest inch,
 * whole feet carried, so `36` reads `3'0"`, `13` reads `1'1"`, and anything
 * under a foot is inches alone (`8"`).
 */
export function formatFeetInches(totalInches: number): string {
  const rounded = Math.max(0, Math.round(totalInches));
  const feet = Math.floor(rounded / 12);
  const inches = rounded % 12;
  return feet > 0 ? `${feet}'${inches}"` : `${inches}"`;
}
