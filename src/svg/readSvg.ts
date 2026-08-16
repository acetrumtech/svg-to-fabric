import type { SvgViewBox } from '../types/document.js';
import type { WarningCollector } from '../utils/warnings.js';
import { parseLength, parseViewBox } from '../utils/units.js';

export const DEFAULT_MAX_FILE_BYTES = 32 * 1024 * 1024;
export const DEFAULT_MAX_DOCUMENT_PIXELS = 100_000_000;

/** A browser's own default when an `<svg>` declares no size at all. */
export const FALLBACK_WIDTH = 300;
export const FALLBACK_HEIGHT = 150;

export type SvgInput = string | ArrayBuffer | Uint8Array | Blob | File;

export interface ReadSvgResult {
  text: string;
  fileName?: string;
  fileSize: number;
}

/**
 * Normalize whatever the host passed into SVG source text.
 *
 * The byte limit is checked before decoding, not after: a 400 MB file that gets
 * decoded first has already cost 800 MB of string before anyone objects.
 */
export async function readSvgInput(
  input: SvgInput,
  maxBytes: number = DEFAULT_MAX_FILE_BYTES,
): Promise<ReadSvgResult> {
  if (typeof input === 'string') {
    // A JS string is UTF-16 in memory; the byte length that matters for a limit
    // is what it would occupy encoded, which is what a file of it would weigh.
    const size = new TextEncoder().encode(input).byteLength;
    assertSize(size, maxBytes);
    return { text: stripBom(input), fileSize: size };
  }

  const isBlob = typeof Blob !== 'undefined' && input instanceof Blob;
  const buffer = isBlob
    ? await (input as Blob).arrayBuffer()
    : input instanceof Uint8Array
      ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
      : input;

  if (!(buffer instanceof ArrayBuffer)) {
    throw new TypeError(
      'Expected an SVG as a string, ArrayBuffer, Uint8Array, Blob or File.',
    );
  }

  assertSize(buffer.byteLength, maxBytes);

  const text = stripBom(new TextDecoder('utf-8').decode(new Uint8Array(buffer)));
  const fileName =
    isBlob && typeof (input as File).name === 'string' ? (input as File).name : undefined;

  return { text, fileSize: buffer.byteLength, ...(fileName ? { fileName } : {}) };
}

function assertSize(bytes: number, maxBytes: number): void {
  if (bytes > maxBytes) {
    throw new RangeError(
      `SVG is ${bytes} bytes, which exceeds the ${maxBytes} byte limit. ` +
        'Raise options.maxFileBytes if this file is expected.',
    );
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse SVG source into a document.
 *
 * `image/svg+xml` rather than `text/html` on purpose. The HTML parser is
 * lenient in ways that matter here — it will happily reinterpret tags, lowercase
 * `viewBox` into `viewbox`, and resurrect markup a sanitizer expected to be
 * inert. XML parsing fails loudly on malformed input instead, which is the
 * behaviour you want before handing the result to anything else.
 */
export function parseSvgText(text: string): SVGSVGElement {
  const DomParser = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!DomParser) {
    throw new Error(
      'No DOMParser is available. This package runs in a browser; under Node, ' +
        'install jsdom and assign globalThis.DOMParser before converting.',
    );
  }

  const doc = new DomParser().parseFromString(text, 'image/svg+xml');

  // Every implementation reports a malformed document as a `<parsererror>`
  // element rather than by throwing, and where it puts it varies.
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) {
    throw new SyntaxError(
      `The file is not valid SVG: ${(error.textContent ?? 'parse error').trim().slice(0, 200)}`,
    );
  }

  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') {
    throw new SyntaxError(
      `Expected an <svg> root element, found <${root?.localName ?? 'nothing'}>.`,
    );
  }

  return root as unknown as SVGSVGElement;
}

export interface ResolvedSize {
  width: number;
  height: number;
  viewBox?: SvgViewBox;
}

/**
 * Work out the pixel size the document should be laid out at.
 *
 * The order matters and mirrors what a browser does: an absolute `width`/
 * `height` wins, because that is the author saying how big the drawing is; a
 * `viewBox` is the fallback, and is what almost every exporter writes; only a
 * file with neither reaches the assumed size, and that always earns a warning
 * because the result will be the wrong size for someone.
 *
 * Percentage widths deliberately fall through to the viewBox. `width="100%"`
 * means "as big as my container", and this converter has no container.
 */
export function resolveSize(
  root: Element,
  options: {
    fallbackSize?: { width: number; height: number } | undefined;
    scale?: number | undefined;
    maxDocumentPixels?: number | undefined;
  },
  warnings: WarningCollector,
): ResolvedSize {
  const viewBox = parseViewBox(root.getAttribute('viewBox'));
  const declaredWidth = parseLength(root.getAttribute('width'));
  const declaredHeight = parseLength(root.getAttribute('height'));

  let width = declaredWidth;
  let height = declaredHeight;

  // One dimension given and the other not is legal; the viewBox's aspect ratio
  // is what fills the gap.
  if (viewBox) {
    const ratio = viewBox.width / viewBox.height;
    if (width === undefined && height !== undefined) width = height * ratio;
    if (height === undefined && width !== undefined) height = width / ratio;
    if (width === undefined && height === undefined) {
      width = viewBox.width;
      height = viewBox.height;
    }
  }

  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    const fallback = options.fallbackSize ?? { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT };
    warnings.add(
      'SIZE_ASSUMED',
      `The file declares no usable width/height or viewBox, so ${fallback.width}×${fallback.height} ` +
        'was assumed. Pass options.fallbackSize to choose a different size.',
      'warning',
    );
    width = fallback.width;
    height = fallback.height;
  }

  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError(`options.scale must be a positive number, received ${String(scale)}.`);
  }

  width *= scale;
  height *= scale;

  const maxPixels = options.maxDocumentPixels ?? DEFAULT_MAX_DOCUMENT_PIXELS;
  if (width * height > maxPixels) {
    throw new RangeError(
      `The document is ${Math.round(width)}×${Math.round(height)} = ` +
        `${Math.round(width * height)} pixels, which exceeds the ${maxPixels} pixel limit.`,
    );
  }

  return { width, height, ...(viewBox ? { viewBox } : {}) };
}
