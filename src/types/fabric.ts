/**
 * Fabric JSON contract.
 *
 * We deliberately do NOT import types from `fabric` here. The JSON this package
 * produces has to be describable without the host's Fabric copy — the only
 * places that touch `fabric` are `svg/parse.ts` and `svg/convert.ts`, and both
 * do it through a dynamic `import()` so that merely importing this package on a
 * server (Next.js) never evaluates Fabric.
 */

/** Namespaced metadata key. Everything this converter adds lives under it. */
export const ACETRUM_PROP = 'acetrum' as const;

/** Schema version for `acetrum`. Bump on any breaking metadata change. */
export const ACETRUM_SCHEMA_VERSION = 1;

export interface AcetrumObjectMeta {
  sourceLayerId: string;
  sourceLayerName: string;
  /** The node type from the document model. */
  sourceType: string;
  /** The SVG tag, lowercased. Kept because `sourceType` buckets several tags. */
  sourceTag: string;
  /** The element's own `id` attribute, when it had one. */
  sourceId?: string;
  /**
   * Ids of this object's ancestor groups, outermost first.
   *
   * This is what lets a host rebuild the layer tree from a flat object list —
   * without it, flattening throws the hierarchy away for anyone who only kept
   * the Fabric JSON.
   */
  sourcePath?: string[];
  /** SVG features dropped on this element. */
  unsupported?: string[];
}

export interface AcetrumDocumentMeta {
  schemaVersion: number;
  source: 'svg';
  generator: string;
  /** Where this converter comes from, so a stray document can be traced back. */
  homepage: string;
  document: {
    width: number;
    height: number;
    fileName?: string;
  };
  /** True when group hierarchy was flattened into a single object list. */
  flattenedGroups: boolean;
}

export interface FabricObjectJson {
  type: string;
  [key: string]: unknown;
}

export interface FabricJson {
  version: string;
  objects: FabricObjectJson[];
  background?: string;
  [ACETRUM_PROP]: AcetrumDocumentMeta;
  [key: string]: unknown;
}
