/**
 * Ids are derived from the node's position in the tree, never from a counter or
 * a random source, so the same SVG + options always produce the same JSON.
 * A host that diffs two imports of the same file gets no spurious changes.
 */
export function makeLayerId(path: readonly number[]): string {
  return `layer-${path.join('.')}`;
}

export function makeAssetId(layerId: string): string {
  return `asset-${layerId}`;
}

const MAX_NAME_LENGTH = 256;

/** C0 controls (0x00-0x1F), DEL (0x7F), and C1 controls (0x80-0x9F). */
function isControlCode(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/**
 * Layer names come from an untrusted file and end up in metadata a host app may
 * render, put in a filename, or write into a DOM node.
 */
export function sanitizeLayerName(name: unknown): string {
  if (typeof name !== 'string') return '';
  let out = '';
  for (const ch of name) {
    const code = ch.codePointAt(0);
    if (code === undefined || isControlCode(code)) continue;
    out += ch;
    if (out.length >= MAX_NAME_LENGTH) break;
  }
  return out.trim();
}
