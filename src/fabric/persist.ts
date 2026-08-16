import type { ConversionResult } from '../types/options.js';
import type { FabricJson, FabricObjectJson } from '../types/fabric.js';

/** Walk every object, including group children and clipPaths. */
function walk(objects: FabricObjectJson[], visit: (object: FabricObjectJson) => void): void {
  for (const object of objects) {
    visit(object);
    if (object.clipPath && typeof object.clipPath === 'object') {
      walk([object.clipPath as FabricObjectJson], visit);
    }
    if (Array.isArray(object.objects)) {
      walk(object.objects as FabricObjectJson[], visit);
    }
  }
}

/**
 * True when the JSON references an image this origin does not own.
 *
 * An SVG's `<image>` is usually already a `data:` URL and needs nothing. When
 * it is a URL, saving the JSON produces a file that looks complete, loads
 * without an error, and renders every path while the photo comes up empty the
 * day that URL moves — and, before that, taints the canvas so `toDataURL()`
 * throws on export.
 */
export function hasExternalAssets(fabricJson: FabricJson): boolean {
  let found = false;
  walk(fabricJson.objects, (object) => {
    if (typeof object.src === 'string' && /^\s*(?:https?:)?\/\//i.test(object.src)) found = true;
  });
  return found;
}

export interface InlineImagesOptions {
  /** Give up on a single image after this many milliseconds. Default 15 000. */
  timeoutMs?: number;
  /** Skip anything larger than this, rather than inlining it. Default 8 MB. */
  maxBytes?: number;
  /** `fetch` to use. Defaults to the global one. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch every externally-referenced image and rewrite it as a `data:` URL, so
 * the JSON is self-contained and the canvas stays exportable.
 *
 * Not part of conversion, and not the default, for two reasons: it makes
 * network requests, which a conversion should never do behind the caller's
 * back; and base64 costs roughly a third more bytes than the binary, which is
 * a bad trade for a document you are about to draw and discard. Call it when
 * the decision to *save* has been made.
 *
 * An image that cannot be fetched is left as it was — a document with one
 * remote photo still beats a rejected save.
 */
export async function inlineImages(
  result: ConversionResult,
  options: InlineImagesOptions = {},
): Promise<{ result: ConversionResult; failed: string[] }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available. Pass options.fetchImpl.');
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;

  const urls = new Set<string>();
  walk(result.fabricJson.objects, (object) => {
    if (typeof object.src === 'string' && /^\s*(?:https?:)?\/\//i.test(object.src)) {
      urls.add(object.src);
    }
  });
  if (urls.size === 0) return { result, failed: [] };

  const inlined = new Map<string, string>();
  const failed: string[] = [];

  await Promise.all(
    [...urls].map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        if (blob.size > maxBytes) throw new Error(`${blob.size} bytes exceeds the limit`);

        inlined.set(url, await blobToDataUrl(blob));
      } catch {
        failed.push(url);
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  if (inlined.size === 0) return { result, failed };

  const fabricJson = JSON.parse(JSON.stringify(result.fabricJson)) as FabricJson;
  walk(fabricJson.objects, (object) => {
    if (typeof object.src !== 'string') return;
    const replacement = inlined.get(object.src);
    if (replacement) object.src = replacement;
  });

  const assets = result.assets.map((asset) => {
    const replacement = inlined.get(asset.url);
    return replacement ? { ...asset, url: replacement, external: false } : asset;
  });

  return { result: { ...result, fabricJson, assets }, failed };
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed.'));
      reader.readAsDataURL(blob);
    });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const base64 =
    typeof btoa !== 'undefined'
      ? btoa(binary)
      : (globalThis as unknown as { Buffer: { from(s: string, e: string): { toString(e: string): string } } })
          .Buffer.from(binary, 'binary')
          .toString('base64');

  return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
}
