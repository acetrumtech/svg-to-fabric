/**
 * Normalized SVG document model.
 *
 * This is the stable boundary between the SVG file and the Fabric output. A
 * host that wants a layers panel reads this tree; a host that only wants
 * objects on a canvas can ignore it entirely and use `fabricJson`.
 *
 * Unlike a PSD, an SVG genuinely carries its own hierarchy — every `<g>` is a
 * group the author made on purpose — so this tree is the file's real structure
 * rather than something inferred.
 */

export type SvgNodeType =
  | 'group'
  | 'path'
  | 'shape'
  | 'text'
  | 'image'
  | 'unknown';

export interface SvgBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SvgNode {
  /** Deterministic, derived from the node's position in the tree. */
  id: string;
  /** Best available human name — see `layerTree.ts` for where it comes from. */
  name: string;
  type: SvgNodeType;
  /** The SVG tag this came from, lowercased: `g`, `path`, `rect`, `text`… */
  tagName: string;
  /** The element's own `id` attribute, when it had one. */
  sourceId?: string;
  /** False when the element was hidden with `display:none` or `visibility:hidden`. */
  visible: boolean;
  /** 0..1, as Fabric ended up with it. */
  opacity: number;
  /** Bounding box in canvas coordinates, after the viewBox transform. */
  bounds: SvgBounds;
  children?: SvgNode[];
  /**
   * Index into the flat object list in `ConversionResult.fabricJson.objects`
   * when groups were flattened, so a host can map a tree row back to the object
   * it produced. Absent on groups, which produce no object of their own.
   */
  objectIndex?: number;
  /** SVG features on this element that could not be represented. */
  unsupported?: string[];
}

export interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgDesign {
  id: string;
  /** Canvas width the objects were laid out for, in pixels. */
  width: number;
  height: number;
  /** The file's own `viewBox`, when it declared one. */
  viewBox?: SvgViewBox;
  children: SvgNode[];
  source?: {
    fileName?: string;
    fileSize?: number;
  };
}
