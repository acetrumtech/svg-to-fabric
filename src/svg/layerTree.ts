import type { SvgBounds, SvgNode, SvgNodeType } from '../types/document.js';
import { makeLayerId, sanitizeLayerName } from '../utils/id.js';

/**
 * The part of a Fabric object this package uses, described structurally so the
 * module never imports `fabric`.
 */
export interface FabricObjectLike {
  type?: string;
  visible?: boolean;
  opacity?: number;
  /** Present on `FabricImage`. Empty when the element carried no usable href. */
  getSrc?(): string;
  getBoundingRect(): { left: number; top: number; width: number; height: number };
  toObject(propertiesToInclude?: string[]): Record<string, unknown>;
}

/** A leaf of the tree: one SVG element and the Fabric object it produced. */
export interface TreeLeaf {
  kind: 'leaf';
  node: SvgNode;
  element: Element;
  object: FabricObjectLike;
}

/** A container: a `<g>`, `<a>` or nested `<svg>` that held other elements. */
export interface TreeGroup {
  kind: 'group';
  node: SvgNode;
  element: Element;
  children: TreeEntry[];
}

export type TreeEntry = TreeLeaf | TreeGroup;

const INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';

const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const TEXT_TAGS = new Set(['text', 'tspan', 'textpath']);

function nodeTypeFor(tagName: string): SvgNodeType {
  if (tagName === 'g' || tagName === 'a' || tagName === 'svg' || tagName === 'switch') {
    return 'group';
  }
  if (tagName === 'path') return 'path';
  if (SHAPE_TAGS.has(tagName)) return 'shape';
  if (TEXT_TAGS.has(tagName)) return 'text';
  if (tagName === 'image') return 'image';
  return 'unknown';
}

/**
 * Find the best human-readable name for an element.
 *
 * The order is not arbitrary — it is what the three exporters that matter
 * actually write:
 *
 *  - Figma puts the layer name in `data-name` and mangles `id` into something
 *    like `Vector_3`, so `data-name` has to win.
 *  - Inkscape keeps its own label in `inkscape:label` and uses `id` for a
 *    generated `path1234`.
 *  - Illustrator writes the layer name straight into `id`.
 *
 * `<title>` comes after all three because it is an accessibility string, which
 * is often a sentence rather than a name; it is still better than nothing.
 */
export function elementName(element: Element, fallback: string): string {
  const candidates = [
    element.getAttribute('data-name'),
    element.getAttributeNS(INKSCAPE_NS, 'label') ?? element.getAttribute('inkscape:label'),
    element.getAttribute('id'),
    directTitle(element),
    element.getAttribute('aria-label'),
  ];

  for (const candidate of candidates) {
    const name = sanitizeLayerName(candidate);
    if (name) return name;
  }
  return fallback;
}

/** Only a direct `<title>` child — a descendant's title names the descendant. */
function directTitle(element: Element): string | null {
  for (const child of Array.from(element.children)) {
    if (child.localName.toLowerCase() === 'title') return child.textContent;
  }
  return null;
}

/**
 * The element's *own* opacity, not including its ancestors'.
 *
 * Fabric's parser has already multiplied ancestor opacity into each object, so
 * the Fabric objects carry the effective value. The document model deliberately
 * carries the authored value instead: that is what a layers panel shows next to
 * a group, and it is the number a user expects to edit.
 */
function ownOpacity(element: Element): number {
  const inline = /(?:^|;)\s*opacity\s*:\s*([\d.]+)/.exec(element.getAttribute('style') ?? '');
  const raw = inline?.[1] ?? element.getAttribute('opacity');
  if (raw === null || raw === undefined) return 1;

  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/** Hidden by the file itself, rather than by anything this converter did. */
export function isHidden(element: Element): boolean {
  const style = element.getAttribute('style') ?? '';
  if (/(?:^|;)\s*display\s*:\s*none/i.test(style)) return true;
  if (/(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)/i.test(style)) return true;
  if ((element.getAttribute('display') ?? '').trim().toLowerCase() === 'none') return true;

  const visibility = (element.getAttribute('visibility') ?? '').trim().toLowerCase();
  return visibility === 'hidden' || visibility === 'collapse';
}

function boundsOf(object: FabricObjectLike): SvgBounds {
  const rect = object.getBoundingRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function unionBounds(children: readonly TreeEntry[]): SvgBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const { left, top, width, height } = child.node.bounds;
    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (left + width > maxX) maxX = left + width;
    if (top + height > maxY) maxY = top + height;
  }

  if (minX === Infinity) return { left: 0, top: 0, width: 0, height: 0 };
  return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Rebuild the SVG's group hierarchy from Fabric's flat parser output.
 *
 * Fabric's SVG parser returns a flat list of objects with every ancestor
 * transform already baked in — which is exactly what makes the objects usable,
 * and exactly what loses the layer structure. What it also returns is the
 * `Element` each object came from, and those elements are still sitting in the
 * parsed document with their parents intact. So the hierarchy does not have to
 * be re-derived: it can be read back off the DOM by walking each element's
 * parent chain.
 *
 * Groups are created lazily, the first time an element inside one shows up.
 * Since `objects` arrives in document order — which is paint order — a group
 * lands in its parent's child list at the position of its first drawable
 * descendant, which is where it belongs in the stack.
 */
export function buildLayerTree(
  elements: readonly Element[],
  objects: readonly (FabricObjectLike | null)[],
  onSkipped: (element: Element, index: number) => void,
): TreeEntry[] {
  const roots: TreeEntry[] = [];
  const groups = new Map<Element, TreeGroup>();
  /** Next child index to hand out, per container. Feeds the deterministic ids. */
  const counters = new Map<TreeGroup | null, number>();

  const childIndex = (parent: TreeGroup | null): number => {
    const next = counters.get(parent) ?? 0;
    counters.set(parent, next + 1);
    return next;
  };

  const idPath = (parent: TreeGroup | null, index: number): string =>
    parent ? `${parent.node.id}.${index}` : makeLayerId([index]);

  const documentRoot = (element: Element): Element | null =>
    element.ownerDocument?.documentElement ?? null;

  /** Create — or find — the group node for a container element. */
  const ensureGroup = (element: Element | null, root: Element | null): TreeGroup | null => {
    if (!element || element === root || !element.parentElement) return null;

    const existing = groups.get(element);
    if (existing) return existing;

    const parent = ensureGroup(element.parentElement, root);
    const index = childIndex(parent);
    const tagName = element.localName.toLowerCase();

    const group: TreeGroup = {
      kind: 'group',
      element,
      children: [],
      node: {
        id: idPath(parent, index),
        name: elementName(element, `Group ${index + 1}`),
        type: 'group',
        tagName,
        ...(element.getAttribute('id') ? { sourceId: element.getAttribute('id') as string } : {}),
        visible: !isHidden(element),
        opacity: ownOpacity(element),
        bounds: { left: 0, top: 0, width: 0, height: 0 },
        children: [],
      },
    };

    groups.set(element, group);
    (parent ? parent.children : roots).push(group);
    parent?.node.children?.push(group.node);
    return group;
  };

  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i];
    const object = objects[i];
    if (!element) continue;

    if (!object) {
      onSkipped(element, i);
      continue;
    }

    const root = documentRoot(element);
    const parent = ensureGroup(element.parentElement, root);
    const index = childIndex(parent);
    const tagName = element.localName.toLowerCase();
    const sourceId = element.getAttribute('id');

    const leaf: TreeLeaf = {
      kind: 'leaf',
      element,
      object,
      node: {
        id: idPath(parent, index),
        name: elementName(element, `${labelFor(tagName)} ${index + 1}`),
        type: nodeTypeFor(tagName),
        tagName,
        ...(sourceId ? { sourceId } : {}),
        visible: !isHidden(element) && object.visible !== false,
        opacity: ownOpacity(element),
        bounds: boundsOf(object),
      },
    };

    (parent ? parent.children : roots).push(leaf);
    parent?.node.children?.push(leaf.node);
  }

  // Bounds bubble up only once the whole tree exists, because a group's box is
  // the union of children that may not have been seen when it was created.
  const measure = (entries: readonly TreeEntry[]): void => {
    for (const entry of entries) {
      if (entry.kind !== 'group') continue;
      measure(entry.children);
      entry.node.bounds = unionBounds(entry.children);
    }
  };
  measure(roots);

  return roots;
}

function labelFor(tagName: string): string {
  if (tagName === 'path') return 'Path';
  if (tagName === 'image') return 'Image';
  if (TEXT_TAGS.has(tagName)) return 'Text';
  if (SHAPE_TAGS.has(tagName)) return tagName.charAt(0).toUpperCase() + tagName.slice(1);
  return 'Layer';
}

/** Every entry in the tree, depth-first, in paint order. */
export function walkTree(entries: readonly TreeEntry[], visit: (entry: TreeEntry) => void): void {
  for (const entry of entries) {
    visit(entry);
    if (entry.kind === 'group') walkTree(entry.children, visit);
  }
}

/* -------------------------------------------------------------------------- */
/* DOM-only tree                                                               */
/* -------------------------------------------------------------------------- */

/** Containers. They hold layers but are not layers themselves. */
const GROUP_TAGS = new Set(['g', 'a', 'switch', 'svg']);

/**
 * Elements that define something for later reference rather than drawing it.
 * Their contents are not layers, and walking into them would invent some.
 */
const NON_RENDERED_TAGS = new Set([
  'defs',
  'clippath',
  'mask',
  'symbol',
  'marker',
  'pattern',
  'lineargradient',
  'radialgradient',
  'filter',
  'style',
  'title',
  'desc',
  'metadata',
]);

/**
 * Build the layer tree straight from the DOM, without converting anything.
 *
 * This is what `parseSvg` uses: reading a file's layer names to show a preview
 * should not cost a Fabric import, a full parse of every path, or a working
 * canvas — and on a server there is no canvas to have. The cost is that no
 * bounds are known, since bounds come from measuring the parsed geometry, so
 * every node reports a zero box.
 */
export function buildDomTree(root: Element): SvgNode[] {
  const walk = (parent: Element, idPrefix: string | null): SvgNode[] => {
    const nodes: SvgNode[] = [];

    for (const element of Array.from(parent.children)) {
      const tagName = element.localName.toLowerCase();
      if (NON_RENDERED_TAGS.has(tagName)) continue;

      const index = nodes.length;
      const id = idPrefix === null ? makeLayerId([index]) : `${idPrefix}.${index}`;
      const sourceId = element.getAttribute('id');
      const isGroup = GROUP_TAGS.has(tagName);

      const node: SvgNode = {
        id,
        name: elementName(
          element,
          isGroup ? `Group ${index + 1}` : `${labelFor(tagName)} ${index + 1}`,
        ),
        type: isGroup ? 'group' : nodeTypeFor(tagName),
        tagName,
        ...(sourceId ? { sourceId } : {}),
        visible: !isHidden(element),
        opacity: ownOpacity(element),
        bounds: { left: 0, top: 0, width: 0, height: 0 },
      };

      if (isGroup) node.children = walk(element, id);

      // A `<g>` that turned out to hold nothing drawable is not a layer the
      // user made; it is scaffolding from an exporter.
      if (isGroup && node.children?.length === 0) continue;

      nodes.push(node);
    }

    return nodes;
  };

  return walk(root, null);
}
