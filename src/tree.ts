import type { SvgNode } from './types/document.js';

/**
 * Every node in the tree, depth-first, in paint order.
 *
 * Paint order is bottom-to-top: the first entry is drawn first and so sits at
 * the *back*. A layers panel conventionally shows the top layer first, so most
 * callers want this reversed.
 */
export function flattenTree(nodes: readonly SvgNode[]): SvgNode[] {
  const out: SvgNode[] = [];
  const walk = (list: readonly SvgNode[]): void => {
    for (const node of list) {
      out.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Find a node by its id, at any depth. */
export function findNode(nodes: readonly SvgNode[], id: string): SvgNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children && findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}
