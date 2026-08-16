import type { ConversionResult } from '../types/options.js';
import type { FabricObjectJson } from '../types/fabric.js';

/** The part of a Fabric canvas these helpers use. Structural, not imported. */
interface FabricCanvasLike {
  loadFromJSON(json: unknown, reviver?: unknown): Promise<unknown>;
  add(...objects: unknown[]): unknown;
  requestRenderAll?(): void;
  renderAll?(): void;
}

function isCanvasLike(value: unknown): value is FabricCanvasLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FabricCanvasLike).loadFromJSON === 'function'
  );
}

/**
 * Replace a canvas's contents with a conversion result.
 *
 * The canvas is a parameter rather than something this package constructs, so
 * the objects are built by the host's Fabric instance. Importing `fabric` here
 * would risk a second copy in the bundle and break `instanceof` against the
 * host's classes.
 *
 * This *clears the canvas*. An editor importing an SVG into an existing design
 * almost always wants `addToFabric` instead.
 */
export async function loadIntoFabric(canvas: unknown, result: ConversionResult): Promise<void> {
  if (!isCanvasLike(canvas)) {
    throw new TypeError(
      'loadIntoFabric expects a Fabric canvas (an object with a loadFromJSON method).',
    );
  }

  await canvas.loadFromJSON(result.fabricJson);
  canvas.requestRenderAll?.() ?? canvas.renderAll?.();
}

/**
 * Add a conversion result's objects to a canvas that already has content, and
 * return the objects that were added.
 *
 * This is the one an editor wants: importing artwork should not throw away the
 * user's document. The canvas-level `clipPath` and background from the result
 * are deliberately ignored here — they describe a whole page, and applying them
 * would clip and repaint everything the user already had.
 */
export async function addToFabric(
  canvas: unknown,
  result: ConversionResult,
  fabricModule?: { util: { enlivenObjects(objects: unknown[]): Promise<unknown[]> } },
): Promise<unknown[]> {
  if (!isCanvasLike(canvas)) {
    throw new TypeError('addToFabric expects a Fabric canvas (an object with an add method).');
  }

  const fabric =
    fabricModule ??
    ((await import('fabric')) as unknown as {
      util: { enlivenObjects(objects: unknown[]): Promise<unknown[]> };
    });

  const objects = await fabric.util.enlivenObjects(
    result.fabricJson.objects as FabricObjectJson[],
  );

  canvas.add(...objects);
  canvas.requestRenderAll?.() ?? canvas.renderAll?.();

  return objects;
}
