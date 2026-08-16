import type { FabricJson, FabricObjectJson } from '../types/fabric.js';

export interface Origin {
  left: number;
  top: number;
}

/**
 * Move a converted document so its top-left corner sits at `origin`.
 *
 * An SVG's coordinates start at (0, 0), but an editor's artboard usually does
 * not: a common pattern is a large workspace canvas with the page centred
 * inside it, so the artboard lands at something like (402, −194). Objects
 * emitted at (0, 0) then appear beside the page rather than on it.
 *
 * Only three things live in canvas coordinates and therefore move:
 *
 *  - top-level objects;
 *  - the document clip;
 *  - any `absolutePositioned` clipPath, at any depth, because that flag is
 *    exactly what declares a clip to be in canvas space.
 *
 * Group children are stored relative to their group's centre, so they must
 * *not* move — shifting them as well would double the offset for everything
 * inside a group.
 */
export function applyOrigin(json: FabricJson, origin: Origin): void {
  if (origin.left === 0 && origin.top === 0) return;

  const shift = (object: FabricObjectJson): void => {
    if (typeof object.left === 'number') object.left += origin.left;
    if (typeof object.top === 'number') object.top += origin.top;
  };

  const shiftAbsoluteClips = (objects: FabricObjectJson[]): void => {
    for (const object of objects) {
      const clip = object.clipPath as FabricObjectJson | undefined;
      if (clip && clip.absolutePositioned === true) shift(clip);
      if (Array.isArray(object.objects)) {
        shiftAbsoluteClips(object.objects as FabricObjectJson[]);
      }
    }
  };

  shiftAbsoluteClips(json.objects);
  for (const object of json.objects) shift(object);

  const documentClip = json.clipPath as FabricObjectJson | undefined;
  if (documentClip) shift(documentClip);
}
