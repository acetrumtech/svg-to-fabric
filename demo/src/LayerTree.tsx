import type { SvgNode } from '@acetrumtech/svg-to-fabric';
import { Icon, type IconName } from './icons.js';

const TYPE_ICON: Record<string, IconName> = {
  group: 'group',
  path: 'path',
  shape: 'shape',
  text: 'text',
  image: 'image',
  unknown: 'unknown',
};

export interface LayerTreeProps {
  nodes: readonly SvgNode[];
  selectedId: string | null;
  hiddenIds: ReadonlySet<string>;
  collapsedIds: ReadonlySet<string>;
  /** When set, only these ids (and their ancestors) are rendered. */
  matchIds: ReadonlySet<string> | null;
  onSelect: (node: SvgNode) => void;
  onToggleVisible: (node: SvgNode) => void;
  onToggleCollapse: (node: SvgNode) => void;
  depth?: number;
}

/**
 * A layers panel, rendered top-layer-first.
 *
 * The tree arrives in paint order — first entry drawn first, so furthest back —
 * which is the reverse of how every design tool lists it.
 */
export function LayerTree({
  nodes,
  selectedId,
  hiddenIds,
  collapsedIds,
  matchIds,
  onSelect,
  onToggleVisible,
  onToggleCollapse,
  depth = 0,
}: LayerTreeProps) {
  const rows = [...nodes]
    .reverse()
    .filter((node) => matchIds === null || matchIds.has(node.id));

  if (rows.length === 0) return null;

  return (
    <ul className="layers" role={depth === 0 ? 'tree' : 'group'}>
      {rows.map((node) => {
        const hidden = hiddenIds.has(node.id) || !node.visible;
        const hasChildren = (node.children?.length ?? 0) > 0;
        // A filtered view is a search result: collapsing it would hide the hit.
        const collapsed = matchIds === null && collapsedIds.has(node.id);

        return (
          <li key={node.id}>
            <div
              className={`layer${selectedId === node.id ? ' is-selected' : ''}${
                hidden ? ' is-hidden' : ''
              }`}
              style={{ paddingLeft: 6 + depth * 13 }}
            >
              {hasChildren ? (
                <button
                  className={`twisty${collapsed ? '' : ' is-open'}`}
                  aria-label={collapsed ? 'Expand' : 'Collapse'}
                  onClick={() => onToggleCollapse(node)}
                >
                  <Icon name="chevron" size={12} />
                </button>
              ) : (
                <span className="twisty-spacer" />
              )}

              <button
                className="layer-name"
                onClick={() => onSelect(node)}
                title={`${node.name} · <${node.tagName}> · ${Math.round(
                  node.bounds.width,
                )}×${Math.round(node.bounds.height)}`}
              >
                <Icon
                  name={TYPE_ICON[node.type] ?? 'unknown'}
                  size={14}
                  className={`glyph glyph-${node.type}`}
                />
                <span className="name">{node.name}</span>
                {node.opacity < 1 && (
                  <span className="chip">{Math.round(node.opacity * 100)}%</span>
                )}
                {node.unsupported?.length ? <span className="chip chip-warn">!</span> : null}
              </button>

              <button
                className="eye"
                aria-label={hidden ? 'Show layer' : 'Hide layer'}
                onClick={() => onToggleVisible(node)}
              >
                <Icon name={hidden ? 'eyeOff' : 'eye'} size={14} />
              </button>
            </div>

            {hasChildren && !collapsed && (
              <LayerTree
                nodes={node.children!}
                selectedId={selectedId}
                hiddenIds={hiddenIds}
                collapsedIds={collapsedIds}
                matchIds={matchIds}
                onSelect={onSelect}
                onToggleVisible={onToggleVisible}
                onToggleCollapse={onToggleCollapse}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
