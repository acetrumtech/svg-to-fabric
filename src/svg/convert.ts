import type { AcetrumObjectMeta, FabricObjectJson } from '../types/fabric.js';
import { ACETRUM_PROP } from '../types/fabric.js';
import type { ConversionAsset } from '../types/options.js';
import type { TreeEntry, TreeGroup, FabricObjectLike } from './layerTree.js';
import { makeAssetId } from '../utils/id.js';
import type { WarningCollector } from '../utils/warnings.js';
import type { ProgressReporter } from '../utils/progress.js';

/** Properties Fabric would otherwise drop from `toObject()`. */
const EXTRA_PROPS = [ACETRUM_PROP, 'name'];

export interface ConvertTreeOptions {
  preserveGroups: boolean;
  includeHidden: boolean;
  setObjectName: boolean;
}

export interface ConvertTreeResult {
  objects: FabricObjectJson[];
  assets: ConversionAsset[];
}

/**
 * Turn the layer tree into Fabric JSON.
 *
 * Metadata is written onto the Fabric *instances* before anything is
 * serialized, not onto the JSON afterwards. That is the only way it survives
 * grouping: `Group.toObject()` serializes its children itself, so a property
 * added to a child's JSON after the fact would be thrown away the moment the
 * child ended up inside a group.
 */
export async function convertTree(
  entries: readonly TreeEntry[],
  options: ConvertTreeOptions,
  warnings: WarningCollector,
  progress: ProgressReporter,
): Promise<ConvertTreeResult> {
  const assets: ConversionAsset[] = [];

  /*
   * An `<image>` whose href the sanitizer stripped still becomes a Fabric
   * `Image` — one with an empty `src` and a zero box. It renders nothing, can
   * never render anything, and would sit in the host's canvas and layers panel
   * as a layer the user can select but not see.
   *
   * It is dropped from the Fabric output and kept in the document tree, marked
   * unsupported: the canvas should not carry a dead object, but the tree is a
   * description of the file, and the file did have an image there.
   */
  const dead = new Set<TreeEntry>();

  const findDead = (list: readonly TreeEntry[]): void => {
    for (const entry of list) {
      if (entry.kind === 'group') {
        findDead(entry.children);
        continue;
      }
      if (entry.node.type !== 'image') continue;
      if (entry.object.getSrc?.()) continue;

      dead.add(entry);
      entry.node.unsupported = [...(entry.node.unsupported ?? []), 'image source unavailable'];
      warnings.info(
        'ELEMENT_SKIPPED',
        `"${entry.node.name}" has no usable image source and was left off the canvas. ` +
          'It is still listed in the document tree.',
        { id: entry.node.id, name: entry.node.name },
      );
    }
  };
  findDead(entries);

  const stamp = (entry: TreeEntry, ancestors: readonly string[]): void => {
    const meta: AcetrumObjectMeta = {
      sourceLayerId: entry.node.id,
      sourceLayerName: entry.node.name,
      sourceType: entry.node.type,
      sourceTag: entry.node.tagName,
      ...(entry.node.sourceId ? { sourceId: entry.node.sourceId } : {}),
      ...(ancestors.length > 0 ? { sourcePath: [...ancestors] } : {}),
      ...(entry.node.unsupported?.length ? { unsupported: entry.node.unsupported } : {}),
    };

    if (entry.kind === 'leaf') {
      const target = entry.object as unknown as Record<string, unknown>;
      target[ACETRUM_PROP] = meta;
      if (options.setObjectName) target.name = entry.node.name;
    } else {
      // Stashed on the tree node; the Group instance does not exist yet in
      // nested mode, and never exists in flat mode.
      (entry as TreeGroup & { meta?: AcetrumObjectMeta }).meta = meta;
    }
  };

  const stampAll = (list: readonly TreeEntry[], ancestors: readonly string[]): void => {
    for (const entry of list) {
      stamp(entry, ancestors);
      if (entry.kind === 'group') stampAll(entry.children, [...ancestors, entry.node.id]);
    }
  };
  stampAll(entries, []);

  const emitted = (entry: TreeEntry): boolean =>
    !dead.has(entry) && (options.includeHidden || entry.node.visible);

  const recordAsset = (entry: TreeEntry, json: FabricObjectJson): void => {
    if (entry.node.type !== 'image' || typeof json.src !== 'string' || json.src === '') return;

    const external = /^\s*(?:https?:)?\/\//i.test(json.src);
    assets.push({
      id: makeAssetId(entry.node.id),
      url: json.src,
      width: Number(json.width) || 0,
      height: Number(json.height) || 0,
      external,
    });

    if (external) {
      warnings.info(
        'EXTERNAL_REFERENCE',
        `"${entry.node.name}" references an image on another origin. Fabric will need CORS ` +
          'to export a canvas containing it; call inlineImages() to embed it instead.',
        { id: entry.node.id, name: entry.node.name },
      );
    }
  };

  /* ------------------------------- flat mode ------------------------------ */

  if (!options.preserveGroups) {
    const objects: FabricObjectJson[] = [];

    const flatten = (list: readonly TreeEntry[]): void => {
      for (const entry of list) {
        if (!emitted(entry)) continue;
        if (entry.kind === 'group') {
          flatten(entry.children);
          continue;
        }
        const json = entry.object.toObject(EXTRA_PROPS) as FabricObjectJson;
        recordAsset(entry, json);
        objects.push(json);
        progress.layerDone(entry.node.name);
      }
    };
    flatten(entries);

    return { objects, assets };
  }

  /* ------------------------------ nested mode ----------------------------- */

  // Imported here rather than at module scope so that importing this package
  // on a server never evaluates Fabric — a Next.js route that only *mentions*
  // the converter should not pay for, or crash on, a browser-only library.
  const { Group } = (await import('fabric')) as unknown as {
    Group: new (objects: FabricObjectLike[]) => FabricObjectLike;
  };

  /**
   * Fabric's SVG parser has already pushed every ancestor transform down onto
   * the leaves, so the children handed to `new Group()` are in absolute canvas
   * coordinates. That is what the constructor expects: it measures the bounding
   * box of what it is given and re-parents the children relative to that box,
   * leaving them exactly where they were on screen. Re-applying the `<g>`'s own
   * transform here would move everything twice.
   */
  const build = (list: readonly TreeEntry[]): FabricObjectLike[] => {
    const built: FabricObjectLike[] = [];

    for (const entry of list) {
      if (!emitted(entry)) continue;

      if (entry.kind === 'leaf') {
        built.push(entry.object);
        progress.layerDone(entry.node.name);
        continue;
      }

      const children = build(entry.children);
      if (children.length === 0) continue;

      const group = new Group(children);
      const target = group as unknown as Record<string, unknown>;
      target[ACETRUM_PROP] = (entry as TreeGroup & { meta?: AcetrumObjectMeta }).meta;
      if (options.setObjectName) target.name = entry.node.name;
      if (!entry.node.visible) target.visible = false;

      built.push(group);
    }

    return built;
  };

  const roots = build(entries);
  const objects = roots.map((object) => object.toObject(EXTRA_PROPS) as FabricObjectJson);

  // Assets are collected from the serialized tree rather than during the build,
  // because a grouped image's JSON lives inside its group's `objects` array.
  const collect = (list: readonly TreeEntry[]): void => {
    for (const entry of list) {
      if (entry.kind === 'group') {
        collect(entry.children);
      } else if (entry.node.type === 'image') {
        recordAsset(entry, entry.object.toObject(EXTRA_PROPS) as FabricObjectJson);
      }
    }
  };
  collect(entries);

  return { objects, assets };
}
