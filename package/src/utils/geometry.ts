export const geo = {
  quadToPoints(quad: [number, number][]): [[number, number], [number, number]] {
    return [
      [Math.min(...quad.map((p) => p[0])), Math.min(...quad.map((p) => p[1]))],
      [Math.max(...quad.map((p) => p[0])), Math.max(...quad.map((p) => p[1]))],
    ];
  },

  cocoBoxToPoints(
    box: [number, number, number, number],
  ): [[number, number], [number, number]] {
    const [x, y, w, h] = box;
    return [
      [x, y],
      [x + w, y + h],
    ];
  },

  yoloBoxToPoints(
    box: [number, number, number, number],
    imgW: number,
    imgH: number,
  ): [[number, number], [number, number]] {
    const [cx, cy, w, h] = box;
    return [
      [(cx - w / 2) * imgW, (cy - h / 2) * imgH],
      [(cx + w / 2) * imgW, (cy + h / 2) * imgH],
    ];
  },

  cocoSegToPoints(seg: number[]): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i < seg.length; i += 2) pts.push([seg[i]!, seg[i + 1]!]);
    return pts;
  },
};
