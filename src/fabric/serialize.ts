import type { SvgDesign } from '../types/document.js';
import type { FabricJson, FabricObjectJson } from '../types/fabric.js';
import { ACETRUM_PROP, ACETRUM_SCHEMA_VERSION } from '../types/fabric.js';

export const GENERATOR = '@acetrumtech/svg-to-fabric@0.1.0';
export const HOMEPAGE = 'https://acetrum.com';
export const DEFAULT_FABRIC_VERSION = '7.0.0';

export interface ArtboardOptions {
  name?: string;
  id?: string;
  fill?: string;
}

/**
 * The page rectangle an editor expects at the bottom of the object stack.
 *
 * `name: 'clip'` is the widely used convention — an editor looks the object up
 * by that name to know how big the page is, to fit the view to it, to resize it
 * and to export it. Without one, a loaded document has no page as far as the
 * host is concerned, and those features quietly do nothing.
 *
 * Non-selectable and non-evented so it never gets in the way of the layers on
 * top of it.
 */
function artboardObject(design: SvgDesign, options: ArtboardOptions): FabricObjectJson {
  return {
    type: 'Rect',
    name: options.name ?? 'clip',
    id: options.id ?? 'workspace',
    left: 0,
    top: 0,
    width: design.width,
    height: design.height,
    originX: 'left',
    originY: 'top',
    fill: options.fill ?? 'rgba(255,255,255,1)',
    stroke: null,
    strokeWidth: 0,
    rx: 0,
    ry: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    selectable: false,
    hasControls: false,
    evented: false,
    excludeFromExport: false,
  };
}

/**
 * Canvas-level clip at the document's edges.
 *
 * An SVG's `viewBox` is a window, and a browser draws nothing outside it — but
 * the geometry that falls outside is still in the file, and Fabric has no such
 * boundary: it paints wherever the canvas element reaches. A drawing loaded
 * onto a canvas larger than itself therefore spills content a browser would
 * have hidden, which looks like a conversion bug and is not one.
 *
 * Emitting the clip makes the JSON describe its own artboard, so it renders the
 * same whatever size canvas it lands on.
 */
function documentClipPath(design: SvgDesign): FabricObjectJson {
  return {
    type: 'Rect',
    left: 0,
    top: 0,
    width: design.width,
    height: design.height,
    originX: 'left',
    originY: 'top',
    strokeWidth: 0,
    absolutePositioned: true,
  };
}

/**
 * Copy each object's layer name onto `name`.
 *
 * Applied as a pass over the finished JSON rather than threaded through the
 * converter, so group children get it at any depth without every code path
 * repeating the same three lines.
 */
export function applyObjectNames(objects: FabricObjectJson[]): void {
  for (const object of objects) {
    const meta = object[ACETRUM_PROP] as { sourceLayerName?: string } | undefined;
    if (meta?.sourceLayerName && object.name === undefined) object.name = meta.sourceLayerName;
    if (Array.isArray(object.objects)) applyObjectNames(object.objects as FabricObjectJson[]);
  }
}

export interface SerializeInput {
  design: SvgDesign;
  objects: FabricObjectJson[];
  background?: string | undefined;
  fabricVersion?: string | undefined;
  flattenedGroups: boolean;
  clipToDocument: boolean;
  artboard?: ArtboardOptions | undefined;
}

/**
 * Assemble the final Fabric JSON document.
 *
 * `background` is omitted unless the caller asks for one. An SVG has no canvas
 * colour — what looks white is either a real `<rect>`, which is already an
 * object, or the page behind a transparent drawing. Painting a default
 * background would be inventing a layer the file does not have.
 */
export function buildFabricJson(input: SerializeInput): FabricJson {
  const { design, background, flattenedGroups } = input;

  const json: FabricJson = {
    version: input.fabricVersion ?? DEFAULT_FABRIC_VERSION,
    // The artboard goes underneath everything, so it is prepended rather than
    // pushed — an editor that looks it up by name finds it either way, but the
    // stacking order has to put the page behind its layers.
    objects: input.artboard
      ? [artboardObject(design, input.artboard), ...input.objects]
      : input.objects,
    [ACETRUM_PROP]: {
      schemaVersion: ACETRUM_SCHEMA_VERSION,
      source: 'svg',
      generator: GENERATOR,
      homepage: HOMEPAGE,
      document: {
        width: design.width,
        height: design.height,
        ...(design.source?.fileName ? { fileName: design.source.fileName } : {}),
      },
      flattenedGroups,
    },
  };

  if (background !== undefined) json.background = background;
  if (input.clipToDocument) json.clipPath = documentClipPath(design);

  return json;
}
