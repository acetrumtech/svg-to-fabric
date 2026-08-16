import { ACETRUM_PROP } from '../types/fabric.js';

/** The shape of Fabric's `FabricObject` class that we need. Not an import. */
export interface FabricObjectClassLike {
  customProperties?: string[];
}

/**
 * Teach the host's Fabric to keep `acetrum` metadata when it serializes.
 *
 * Fabric restores unknown properties onto the object instance during
 * `loadFromJSON`, but `toObject()` drops anything not in `customProperties` —
 * so without this call the layer metadata survives the import and then silently
 * disappears the first time the host editor saves the canvas. The layers panel
 * works until the user reloads, which is the worst way to find out.
 *
 * Call it once at editor start-up, passing the host's own Fabric class so the
 * converter never touches the peer dependency itself:
 *
 * ```ts
 * import { FabricObject } from 'fabric';
 * import { registerAcetrumProperties } from '@acetrumtech/svg-to-fabric';
 *
 * registerAcetrumProperties(FabricObject);
 * ```
 *
 * Pass `'name'` too if your editor does not already keep it.
 */
export function registerAcetrumProperties(
  fabricObjectClass: FabricObjectClassLike,
  extra: readonly string[] = ['name'],
): void {
  const existing = fabricObjectClass.customProperties ?? [];
  const wanted = [ACETRUM_PROP, ...extra].filter((prop) => !existing.includes(prop));
  if (wanted.length === 0) return;
  fabricObjectClass.customProperties = [...existing, ...wanted];
}
