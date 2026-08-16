import type { SvgDesign } from './document.js';
import type { FabricJson } from './fabric.js';

export type ConversionWarningCode =
  /** An element Fabric's parser could not turn into an object. */
  | 'UNSUPPORTED_ELEMENT'
  /** A feature with no canvas equivalent — filters, masks, animation. */
  | 'UNSUPPORTED_FEATURE'
  /** Deliberately not converted, because the options said not to. */
  | 'ELEMENT_SKIPPED'
  /** Something active was stripped by the sanitizer. Always worth surfacing. */
  | 'SCRIPT_REMOVED'
  /** A reference to another origin — an `<image>` or `<use>` pointing at a URL. */
  | 'EXTERNAL_REFERENCE'
  /** The document declared no usable size and one had to be assumed. */
  | 'SIZE_ASSUMED'
  /** The file was malformed but enough of it parsed to continue. */
  | 'PARSE_RECOVERED';

export interface ConversionWarning {
  code: ConversionWarningCode;
  layerId?: string;
  layerName?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/** Stages a conversion moves through, in order. */
export type ConversionPhase =
  | 'parsing'
  | 'sanitizing'
  | 'building'
  | 'converting'
  | 'done';

export interface ConversionProgress {
  phase: ConversionPhase;
  /** Elements finished so far. `0` until the element list is known. */
  completed: number;
  /** Total elements to convert. `0` until the element list is known. */
  total: number;
  /** 0..1, monotonically non-decreasing across the whole conversion. */
  ratio: number;
  /** The element just finished, when the phase is per-element. */
  layerName?: string;
}

/**
 * Every field is declared `?: T | undefined` rather than `?: T` so that hosts
 * compiling with `exactOptionalPropertyTypes` can forward a possibly-undefined
 * value straight through without a cast.
 */
export interface ConvertOptions {
  /**
   * Emit `<g>` elements as Fabric `Group` objects instead of flattening them
   * into one object list. Default `false`, because a flat list is what most
   * editors expect from an import; the hierarchy is on `result.document` either
   * way, and every object carries its ancestor ids in `acetrum.sourcePath`.
   */
  preserveGroups?: boolean | undefined;
  /**
   * Include elements the file hid with `display:none` or `visibility:hidden`,
   * as `visible: false`. Default `true`.
   */
  includeHidden?: boolean | undefined;
  /**
   * Strip scripts, event handlers and `javascript:` URLs before parsing.
   * Default `true`, and there is no good reason to turn it off for a file that
   * came from a user — an SVG is markup, and markup that reaches the DOM runs.
   */
  sanitize?: boolean | undefined;
  /**
   * Allow `<image>` and `<use>` to reference other origins over http(s).
   * Default `false`: those references leak the viewer's IP to a third party,
   * can be used as a tracking pixel, and produce a canvas that silently fails
   * to export once tainted. Enable it when you trust the source.
   */
  allowExternalResources?: boolean | undefined;
  /** Canvas background. Omitted from the output when not set. */
  background?: string | undefined;
  /**
   * Place the document's top-left corner at this canvas position.
   *
   * An SVG starts at (0, 0); an editor's artboard often does not — a workspace
   * canvas with the page centred inside it puts the artboard at an arbitrary
   * offset. Pass that artboard's `left`/`top` and the objects land on the page
   * instead of beside it. Default `{ left: 0, top: 0 }`.
   */
  origin?: { left: number; top: number } | undefined;
  /**
   * Set `name` on every object to its layer name. Default `true`.
   *
   * `name` is not a Fabric property, but it is the convention editors key their
   * layers panel on. Harmless if unused; add `'name'` to your serializer's
   * property list to keep it across saves.
   */
  setObjectName?: boolean | undefined;
  /**
   * Emit an artboard rectangle as the first object. Default `false`.
   *
   * Many editors model the page as a non-selectable rectangle at the bottom of
   * the stack — conventionally named `clip` — and find it by name to drive
   * zoom-to-fit, page resize and export.
   */
  emitArtboard?: boolean | { name?: string; id?: string; fill?: string } | undefined;
  /**
   * Emit a canvas-level `clipPath` at the document's edges, so artwork that
   * extends past the viewBox stays hidden the way a browser hides it.
   * Default `true`.
   *
   * Turn it off if your editor deliberately shows the area around the artboard,
   * or adds its own objects to the same canvas — a canvas clip applies to
   * everything on it, including anything the host adds later.
   */
  clipToDocument?: boolean | undefined;
  /**
   * Size to assume when the file declares neither a usable `width`/`height` nor
   * a `viewBox`. Default `{ width: 300, height: 150 }`, which is what a browser
   * uses. A warning is always emitted when this is reached.
   */
  fallbackSize?: { width: number; height: number } | undefined;
  /**
   * Scale the whole document by this factor. Default `1`.
   *
   * An icon authored at 24×24 is unusable as a 24px object on a 1080p artboard;
   * scaling at conversion time keeps the path data exact, where scaling the
   * objects afterwards multiplies through every transform.
   */
  scale?: number | undefined;
  /**
   * Value written to the Fabric JSON `version` field. Set this to the host
   * editor's own Fabric version so the schema stays aligned. Default `'7.0.0'`.
   */
  fabricVersion?: string | undefined;
  /** `crossOrigin` used when Fabric loads an `<image>`. */
  crossOrigin?: 'anonymous' | 'use-credentials' | undefined;
  /** Abort a conversion that is still loading images. */
  signal?: AbortSignal | undefined;
  /**
   * Called after each element is converted, with the source element and the
   * object Fabric built from it. Use it to read attributes this converter does
   * not, or to stamp your own metadata.
   */
  reviver?: ((element: Element, object: unknown) => void) | undefined;
  /** Progress callback. Called on every phase change and after each element. */
  onProgress?: ((progress: ConversionProgress) => void) | undefined;
  /** Reject inputs larger than this. Default 32 MB. */
  maxFileBytes?: number | undefined;
  /** Reject documents with more pixels than this. Default 100_000_000. */
  maxDocumentPixels?: number | undefined;
  /** Reject documents with more drawable elements than this. Default 50_000. */
  maxElements?: number | undefined;
}

/**
 * An image the SVG referenced. Nothing is re-encoded — an SVG's images are
 * already `data:` URLs or URLs, so this is a manifest rather than an extraction.
 */
export interface ConversionAsset {
  id: string;
  /** The string the Fabric object's `src` actually points at. */
  url: string;
  width: number;
  height: number;
  /** True when `url` leaves this origin, and so may taint the canvas. */
  external: boolean;
}

export interface ConversionResult {
  fabricJson: FabricJson;
  document: SvgDesign;
  assets: ConversionAsset[];
  warnings: ConversionWarning[];
}
