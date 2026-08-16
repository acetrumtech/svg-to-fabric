import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveSelection, Canvas, type FabricObject } from 'fabric';
import {
  ACETRUM_PROP,
  convertSvgToFabric,
  findNode,
  flattenTree,
  loadIntoFabric,
  type ConversionResult,
  type ConvertOptions,
  type SvgNode,
} from '@acetrumtech/svg-to-fabric';
import { LayerTree } from './LayerTree.js';
import { Icon } from './icons.js';

interface DemoOptions {
  preserveGroups: boolean;
  includeHidden: boolean;
  emitArtboard: boolean;
  allowExternalResources: boolean;
  scale: number;
}

const DEFAULTS: DemoOptions = {
  preserveGroups: false,
  includeHidden: true,
  emitArtboard: false,
  allowExternalResources: false,
  scale: 1,
};

const OPTION_COPY: Array<{ key: keyof DemoOptions; label: string; hint: string }> = [
  {
    key: 'preserveGroups',
    label: 'Preserve groups',
    hint: 'Emit nested Fabric Groups instead of a flat object list.',
  },
  {
    key: 'includeHidden',
    label: 'Include hidden',
    hint: 'Keep layers the file hid, marked visible: false.',
  },
  {
    key: 'emitArtboard',
    label: 'Emit artboard',
    hint: 'Prepend a non-selectable page rect named “clip”.',
  },
  {
    key: 'allowExternalResources',
    label: 'Allow remote assets',
    hint: 'Permit <image>/<use> pointing at another origin.',
  },
];

type Tab = 'layers' | 'warnings' | 'json';
type Backdrop = 'checker' | 'light' | 'dark';

/** Metadata this package writes onto every object it produces. */
function metaOf(object: FabricObject): { sourceLayerId?: string; sourcePath?: string[] } {
  return (object as unknown as Record<string, never>)[ACETRUM_PROP] ?? {};
}

/** Every object on the canvas, including group children. */
function allObjects(objects: readonly FabricObject[]): FabricObject[] {
  return objects.flatMap((object) => {
    const children = (object as unknown as { _objects?: FabricObject[] })._objects;
    return children ? [object, ...allObjects(children)] : [object];
  });
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

export function App() {
  const canvasElement = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<Canvas | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const filePicker = useRef<HTMLInputElement | null>(null);

  const [result, setResult] = useState<ConversionResult | null>(null);
  const [source, setSource] = useState<{ name: string; svg: string; bytes: number } | null>(null);
  const [options, setOptions] = useState<DemoOptions>(DEFAULTS);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const [tab, setTab] = useState<Tab>('layers');
  const [zoom, setZoom] = useState(1);
  const [backdrop, setBackdrop] = useState<Backdrop>('checker');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ------------------------------- the canvas ------------------------------ */

  useEffect(() => {
    if (!canvasElement.current) return;

    const instance = new Canvas(canvasElement.current, {
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
    });
    canvas.current = instance;

    const syncSelection = (): void => {
      const active = instance.getActiveObject();
      setSelectedId(active ? (metaOf(active).sourceLayerId ?? null) : null);
    };
    instance.on('selection:created', syncSelection);
    instance.on('selection:updated', syncSelection);
    instance.on('selection:cleared', syncSelection);

    return () => {
      void instance.dispose();
      canvas.current = null;
    };
  }, []);

  const applyZoom = useCallback((next: number, design: { width: number; height: number }) => {
    const instance = canvas.current;
    if (!instance) return;

    instance.setDimensions({ width: design.width * next, height: design.height * next });
    instance.setZoom(next);
    instance.requestRenderAll();
  }, []);

  /** The zoom at which the document just fits the stage, capped at 1:1. */
  const fitZoom = useCallback((design: { width: number; height: number }) => {
    const box = stage.current?.getBoundingClientRect();
    const width = (box?.width ?? 640) - 48;
    const height = (box?.height ?? 480) - 48;
    return Math.min(width / design.width, height / design.height, 1);
  }, []);

  const zoomTo = (next: number): void => {
    if (!result) return;
    const clamped = Math.min(8, Math.max(0.05, next));
    setZoom(clamped);
    applyZoom(clamped, result.document);
  };

  const fit = (): void => {
    if (!result) return;
    zoomTo(fitZoom(result.document));
  };

  /* ------------------------------ conversion ------------------------------- */

  const convert = useCallback(
    async (svg: string, name: string, using: DemoOptions) => {
      setBusy(true);
      setError(null);

      const started = performance.now();
      try {
        const convertOptions: ConvertOptions = {
          preserveGroups: using.preserveGroups,
          includeHidden: using.includeHidden,
          emitArtboard: using.emitArtboard,
          allowExternalResources: using.allowExternalResources,
          scale: using.scale,
        };

        const converted = await convertSvgToFabric(svg, convertOptions);
        setElapsed(performance.now() - started);
        setResult(converted);
        setSource({ name, svg, bytes: new Blob([svg]).size });
        setHiddenIds(new Set());
        setCollapsedIds(new Set());
        setSelectedId(null);
        // A filter from the previous file would otherwise greet the new one
        // with "no layer matches", which reads as a broken conversion.
        setFilter('');
        setTab('layers');

        const next = fitZoom(converted.document);
        setZoom(next);
        applyZoom(next, converted.document);

        // Replaces the canvas contents, which is what a demo wants; an editor
        // importing into an existing design would call addToFabric instead.
        await loadIntoFabric(canvas.current, converted);
      } catch (cause) {
        setResult(null);
        setSource(null);
        setElapsed(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    },
    [applyZoom, fitZoom],
  );

  /** Re-run the last conversion whenever an option changes. */
  const updateOption = <K extends keyof DemoOptions>(key: K, value: DemoOptions[K]): void => {
    const next = { ...options, [key]: value };
    setOptions(next);
    if (source) void convert(source.svg, source.name, next);
  };

  const openFile = async (file: File): Promise<void> => {
    if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
      setError(`“${file.name}” is not an SVG.`);
      return;
    }
    await convert(await file.text(), file.name, options);
  };

  const reset = (): void => {
    canvas.current?.clear();
    setResult(null);
    setSource(null);
    setError(null);
    setElapsed(null);
    setSelectedId(null);
    setFilter('');
  };

  /* ------------------------- layer panel interaction ----------------------- */

  const selectLayer = (node: SvgNode): void => {
    const instance = canvas.current;
    if (!instance) return;

    setSelectedId(node.id);
    const objects = allObjects(instance.getObjects());

    const exact = objects.find((object) => metaOf(object).sourceLayerId === node.id);
    if (exact) {
      instance.setActiveObject(exact);
      instance.requestRenderAll();
      return;
    }

    // A group row with no object of its own — which is what flattening means.
    // `sourcePath` is exactly what makes this recoverable.
    const descendants = objects.filter((object) => metaOf(object).sourcePath?.includes(node.id));
    if (descendants.length === 0) return;

    instance.setActiveObject(
      descendants.length === 1
        ? descendants[0]!
        : new ActiveSelection(descendants, { canvas: instance }),
    );
    instance.requestRenderAll();
  };

  const toggleVisible = (node: SvgNode): void => {
    const instance = canvas.current;
    if (!instance) return;

    const nowHidden = !(hiddenIds.has(node.id) || !node.visible);
    const ids = new Set([node.id, ...flattenTree(node.children ?? []).map((child) => child.id)]);

    for (const object of allObjects(instance.getObjects())) {
      const meta = metaOf(object);
      const id = meta.sourceLayerId;
      const touched = (id && ids.has(id)) || meta.sourcePath?.includes(node.id);
      if (touched) object.set('visible', !nowHidden);
    }

    setHiddenIds((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (nowHidden) next.add(id);
        else next.delete(id);
      }
      return next;
    });

    instance.requestRenderAll();
  };

  const toggleCollapse = (node: SvgNode): void => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  /* --------------------------------- derived -------------------------------- */

  const json = useMemo(
    () => (result ? JSON.stringify(result.fabricJson, null, 2) : ''),
    [result],
  );

  /** Search hits plus their ancestors, so a nested match stays reachable. */
  const matchIds = useMemo<Set<string> | null>(() => {
    if (!result || filter.trim() === '') return null;
    const needle = filter.trim().toLowerCase();
    const keep = new Set<string>();

    const walk = (nodes: readonly SvgNode[], ancestors: string[]): void => {
      for (const node of nodes) {
        const hit =
          node.name.toLowerCase().includes(needle) || node.tagName.includes(needle);
        if (hit) {
          keep.add(node.id);
          for (const id of ancestors) keep.add(id);
        }
        if (node.children) walk(node.children, [...ancestors, node.id]);
      }
    };
    walk(result.document.children, []);
    return keep;
  }, [result, filter]);

  const stats = useMemo(() => {
    if (!result) return null;
    const nodes = flattenTree(result.document.children);
    return {
      layers: nodes.length,
      groups: nodes.filter((node) => node.type === 'group').length,
      objects: result.fabricJson.objects.length,
      bytes: new Blob([json]).size,
    };
  }, [result, json]);

  const selected = result && selectedId ? findNode(result.document.children, selectedId) : undefined;

  const bySeverity = useMemo(() => {
    const order = { error: 0, warning: 1, info: 2 } as const;
    return [...(result?.warnings ?? [])].sort(
      (a, b) => order[a.severity] - order[b.severity],
    );
  }, [result]);

  const copyJson = async (): Promise<void> => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = (): void => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(source?.name ?? 'document').replace(/\.svg$/i, '')}.fabric.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------------------------- view ---------------------------------- */

  return (
    <div
      className={`shell${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void openFile(file);
      }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="mark">
            svg<i>→</i>fabric
          </span>
          <span className="tagline">named, editable Fabric.js layers</span>
        </div>

        <div className="topbar-right">
          {source && (
            <span className="file-chip" title={source.name}>
              {source.name}
              <em>{formatBytes(source.bytes)}</em>
            </span>
          )}
          <button className="btn btn-primary" onClick={() => filePicker.current?.click()}>
            <Icon name="upload" size={14} /> Import SVG
          </button>
          {result && (
            <button className="btn" onClick={reset} title="Clear the canvas">
              <Icon name="reset" size={14} />
            </button>
          )}
        </div>

        <input
          ref={filePicker}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
            event.target.value = '';
          }}
        />
      </header>

      <main className="workspace">
        {/* ------------------------------ left rail ----------------------------- */}
        <aside className="rail">
          <section className="block">
            <h2>Options</h2>
            <div className="options">
              {OPTION_COPY.map(({ key, label, hint }) => (
                <label key={key} className="toggle">
                  <input
                    type="checkbox"
                    checked={options[key] as boolean}
                    onChange={(event) => updateOption(key, event.target.checked as never)}
                  />
                  <span className="track" aria-hidden="true" />
                  <span className="toggle-text">
                    <strong>{label}</strong>
                    <em>{hint}</em>
                  </span>
                </label>
              ))}

              <div className="slider">
                <div className="slider-head">
                  <strong>Scale</strong>
                  <span>{options.scale}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={options.scale}
                  onChange={(event) => updateOption('scale', Number(event.target.value))}
                />
                <em>Applied at parse time, so path data stays exact.</em>
              </div>
            </div>
          </section>
        </aside>

        {/* ------------------------------- canvas ------------------------------- */}
        <section className="canvas-pane">
          <div className="pane-bar">
            <div className="zoom">
              <button className="icon-btn" onClick={() => zoomTo(zoom / 1.25)} disabled={!result}>
                <Icon name="zoomOut" size={15} />
              </button>
              <span className="zoom-value">{Math.round(zoom * 100)}%</span>
              <button className="icon-btn" onClick={() => zoomTo(zoom * 1.25)} disabled={!result}>
                <Icon name="zoomIn" size={15} />
              </button>
              <button className="icon-btn" onClick={fit} disabled={!result} title="Fit to view">
                <Icon name="fit" size={15} />
              </button>
              <button
                className="icon-btn text"
                onClick={() => zoomTo(1)}
                disabled={!result}
                title="Actual size"
              >
                1:1
              </button>
            </div>

            <div className="backdrops">
              {(['checker', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`swatch swatch-${mode}${backdrop === mode ? ' is-active' : ''}`}
                  onClick={() => setBackdrop(mode)}
                  title={`${mode} backdrop`}
                  aria-label={`${mode} backdrop`}
                />
              ))}
            </div>
          </div>

          <div ref={stage} className={`stage stage-${backdrop}`}>
            <canvas ref={canvasElement} />

            {!result && !busy && (
              <div className="empty-state">
                <Icon name="upload" size={26} />
                <strong>Drop an SVG anywhere</strong>
                <span>and get named, editable Fabric.js layers</span>
                <button className="btn" onClick={() => filePicker.current?.click()}>
                  Choose a file
                </button>
              </div>
            )}
            {busy && <div className="empty-state"><span className="spinner" />Converting…</div>}
          </div>

          {error && (
            <p className="error">
              <Icon name="error" size={15} />
              {error}
            </p>
          )}
        </section>

        {/* ------------------------------ inspector ----------------------------- */}
        <aside className="inspector">
          <div className="tabs" role="tablist">
            <button
              role="tab"
              className={tab === 'layers' ? 'is-active' : ''}
              onClick={() => setTab('layers')}
            >
              Layers {stats && <b>{stats.layers}</b>}
            </button>
            <button
              role="tab"
              className={tab === 'warnings' ? 'is-active' : ''}
              onClick={() => setTab('warnings')}
            >
              Warnings
              {result && result.warnings.length > 0 && (
                <b className="b-warn">{result.warnings.length}</b>
              )}
            </button>
            <button
              role="tab"
              className={tab === 'json' ? 'is-active' : ''}
              onClick={() => setTab('json')}
            >
              JSON
            </button>
          </div>

          {!result && <p className="empty-note">Convert a file to inspect it.</p>}

          {result && tab === 'layers' && (
            <>
              <div className="search">
                <Icon name="search" size={13} />
                <input
                  placeholder="Filter layers…"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
                {filter && (
                  <button onClick={() => setFilter('')} aria-label="Clear filter">
                    <Icon name="close" size={12} />
                  </button>
                )}
              </div>

              <div className="scroll">
                <LayerTree
                  nodes={result.document.children}
                  selectedId={selectedId}
                  hiddenIds={hiddenIds}
                  collapsedIds={collapsedIds}
                  matchIds={matchIds}
                  onSelect={selectLayer}
                  onToggleVisible={toggleVisible}
                  onToggleCollapse={toggleCollapse}
                />
                {matchIds?.size === 0 && <p className="empty-note">No layer matches “{filter}”.</p>}
              </div>

              {selected && (
                <div className="details">
                  <h3>{selected.name}</h3>
                  <dl>
                    <dt>id</dt>
                    <dd>{selected.id}</dd>
                    <dt>tag</dt>
                    <dd>&lt;{selected.tagName}&gt;</dd>
                    <dt>type</dt>
                    <dd>{selected.type}</dd>
                    {selected.sourceId && (
                      <>
                        <dt>source id</dt>
                        <dd>{selected.sourceId}</dd>
                      </>
                    )}
                    <dt>bounds</dt>
                    <dd>
                      {Math.round(selected.bounds.width)} × {Math.round(selected.bounds.height)} at{' '}
                      {Math.round(selected.bounds.left)}, {Math.round(selected.bounds.top)}
                    </dd>
                    <dt>opacity</dt>
                    <dd>{selected.opacity}</dd>
                  </dl>
                </div>
              )}
            </>
          )}

          {result && tab === 'warnings' && (
            <div className="scroll">
              {bySeverity.length === 0 ? (
                <p className="empty-note">Nothing to report — everything converted cleanly.</p>
              ) : (
                <ul className="warnings">
                  {bySeverity.map((warning, index) => (
                    <li key={index} className={`w-${warning.severity}`}>
                      <Icon
                        name={
                          warning.severity === 'error'
                            ? 'error'
                            : warning.severity === 'warning'
                              ? 'alert'
                              : 'info'
                        }
                        size={14}
                      />
                      <div>
                        <code>{warning.code}</code>
                        <p>{warning.message}</p>
                        {warning.layerName && <em>on “{warning.layerName}”</em>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && tab === 'json' && (
            <>
              <div className="json-actions">
                <button className="btn" onClick={() => void copyJson()}>
                  <Icon name="copy" size={14} /> {copied ? 'Copied' : 'Copy'}
                </button>
                <button className="btn" onClick={download}>
                  <Icon name="download" size={14} /> Download
                </button>
              </div>
              <div className="scroll">
                <pre className="json">{json}</pre>
              </div>
            </>
          )}
        </aside>
      </main>

      <footer className="statusbar">
        {result && stats ? (
          <>
            <span>
              <b>{Math.round(result.document.width)} × {Math.round(result.document.height)}</b> px
            </span>
            <span>
              <b>{stats.layers}</b> layers · <b>{stats.groups}</b> groups
            </span>
            <span>
              <b>{stats.objects}</b> top-level object{stats.objects === 1 ? '' : 's'}
            </span>
            <span>
              JSON <b>{formatBytes(stats.bytes)}</b>
            </span>
            <span className="spacer" />
            <span className={options.preserveGroups ? 'flag is-on' : 'flag'}>
              {options.preserveGroups ? 'nested groups' : 'flattened'}
            </span>
            {elapsed !== null && (
              <span>
                converted in <b>{elapsed.toFixed(0)} ms</b>
              </span>
            )}
          </>
        ) : (
          <span className="muted">No document loaded</span>
        )}
      </footer>

      {dragging && (
        <div className="drop-overlay">
          <div>
            <Icon name="upload" size={30} />
            <strong>Drop to convert</strong>
          </div>
        </div>
      )}
    </div>
  );
}
