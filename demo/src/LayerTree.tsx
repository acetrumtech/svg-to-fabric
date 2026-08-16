import type { SvgNode } from '@acetrumtech/svg-to-fabric';

const TYPE_GLYPH: Record<string, string> = {
  group: '▤',
  path: '✎',
  shape: '◻',
  text: 'T',
  image: '▣',
  unknown: '?',
};

export interface LayerTreeProps {
  nodes: readonly SvgNode[];
  selectedId: string | null;
  hiddenIds: ReadonlySet<string>;
  onSelect: (node: SvgNode) => void;
  onToggleVisible: (node: SvgNode) => void;
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
  onSelect,
  onToggleVisible,
  depth = 0,
}: LayerTreeProps) {
  return (
    <ul className="layers" style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      {[...nodes].reverse().map((node) => {
        const hidden = hiddenIds.has(node.id) || !node.visible;

        return (
          <li key={node.id}>
            <div
              className={`layer${selectedId === node.id ? ' is-selected' : ''}${
                hidden ? ' is-hidden' : ''
              }`}
            >
              <button
                className="eye"
                title={hidden ? 'Show' : 'Hide'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleVisible(node);
                }}
              >
                {hidden ? '○' : '●'}
              </button>

              <button className="layer-name" onClick={() => onSelect(node)}>
                <span className="glyph" title={node.tagName}>
                  {TYPE_GLYPH[node.type] ?? '?'}
                </span>
                <span className="name">{node.name}</span>
                <span className="tag">{node.tagName}</span>
              </button>
            </div>

            {node.children && node.children.length > 0 && (
              <LayerTree
                nodes={node.children}
                selectedId={selectedId}
                hiddenIds={hiddenIds}
                onSelect={onSelect}
                onToggleVisible={onToggleVisible}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
