/**
 * CSS absolute units, in pixels, as the SVG/CSS spec fixes them.
 *
 * Only absolute units can be resolved here. `em`, `ex`, `rem`, `ch` and `%`
 * depend on a font or a containing block that does not exist at parse time —
 * a file using them for its root size falls back to the viewBox instead, which
 * is what a browser effectively does anyway.
 */
const UNIT_PX: Readonly<Record<string, number>> = {
  '': 1,
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
};

/**
 * Parse an SVG length attribute into pixels.
 *
 * Returns `undefined` for a relative unit or unparseable value, so the caller
 * can fall through to the viewBox rather than acting on a wrong number.
 */
export function parseLength(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;

  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z%]*)\s*$/.exec(value);
  if (!match) return undefined;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;

  const factor = UNIT_PX[(match[2] ?? '').toLowerCase()];
  if (factor === undefined) return undefined;

  return number * factor;
}

/** Parse a `viewBox` attribute. Returns `undefined` unless all four numbers are present. */
export function parseViewBox(
  value: string | null | undefined,
): { x: number; y: number; width: number; height: number } | undefined {
  if (!value) return undefined;

  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;

  const [x, y, width, height] = parts as [number, number, number, number];
  if (width <= 0 || height <= 0) return undefined;

  return { x, y, width, height };
}
