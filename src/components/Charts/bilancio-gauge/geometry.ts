export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Coordinate punto su cerchio.
 * 0deg = a destra; -90deg = in alto.
 */
export function polar(cx: number, cy: number, r: number, deg: number) {
  const a = degToRad(deg);
  return {
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  };
}

/**
 * Path di arco SVG da angolo start -> end (in gradi).
 */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);

  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

/**
 * Mappa pct 0..1 su ampiezza arco.
 */
export function pctToArcDeg(pct01: number, startDeg: number, endDeg: number) {
  const p = clamp(pct01, 0, 1);
  return startDeg + (endDeg - startDeg) * p;
}
