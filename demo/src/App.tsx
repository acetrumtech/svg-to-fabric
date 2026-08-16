import { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveSelection, Canvas, type FabricObject } from 'fabric';
import {
  ACETRUM_PROP,
  convertSvgToFabric,
  flattenTree,
  loadIntoFabric,
  type ConversionResult,
  type ConvertOptions,
  type SvgNode,
} from '@acetrumtech/svg-to-fabric';
import { LayerTree } from './LayerTree.js';
import { SAMPLES } from './samples.js';

/** The options this demo exposes. Everything else stays at its default. */
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

const VIEWPORT = { width: 620, height: 460 };

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

export function App() {
  const canvasElement = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<Canvas | null>(null);

  const [result, setResult] = useState<ConversionResult | null>(null);
  const [source, setSource] = useState<{ name: string; svg: string } | null>(null);
  const [options, setOptions] = useState<DemoOptions>(DEFAULTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

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
        setSource({ name, svg });
        setHiddenIds(new Set());
        setSelectedId(null);

        const instance = canvas.current;
        if (!instance) return;

        // Fit the document into the viewport. `loadIntoFabric` replaces the
        // canvas contents, which is what a demo wants; an editor importing into
        // an existing design would call `addToFabric` instead.
        const zoom = Math.min(
          VIEWPORT.width / converted.document.width,
          VIEWPORT.height / converted.document.height,
          1,
        );
        instance.setDimensions({
          width: converted.document.width * zoom,
          height: converted.document.height * zoom,
        });
        instance.setZoom(zoom);

        await loadIntoFabric(instance, converted);
      } catch (cause) {
        setResult(null);
        setElapsed(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Re-run the last conversion whenever an option changes. */
  const updateOption = <K extends keyof DemoOptions>(key: K, value: DemoOptions[K]): void => {
    const next = { ...options, [key]: value };
    setOptions(next);
    if (source) void convert(source.svg, source.name, next);
  };

  const openFile = async (file: File): Promise<void> => {
    if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
      setError(`"${file.name}" is not an SVG.`);
      return;
    }
    await convert(await file.text(), file.name, options);
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

  /* --------------------------------- output -------------------------------- */

  const json = result ? JSON.stringify(result.fabricJson, null, 2) : '';

  const download = (): void => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(source?.name ?? 'document').replace(/\.svg$/i, '')}.fabric.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const layerCount = result ? flattenTree(result.document.children).length : 0;

  return (
    <div className="app">
      <header>
        <h1>
          svg<span>→</span>fabric
        </h1>
        <p>Drop an SVG. Get named, editable Fabric.js layers.</p>
      </header>

      <div className="grid">
        {/* ------------------------------ input ----------------------------- */}
        <section className="panel">
          <h2>1 · Input</h2>

          <label
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void openFile(file);
            }}
          >
            <input
              type="file"
              accept=".svg,image/svg+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void openFile(file);
                event.target.value = '';
              }}
            />
            <strong>Drop an SVG here</strong>
            <span>or click to choose a file</span>
          </label>

          <div className="samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample.label}
                className="sample"
                title={sample.note}
                onClick={() => void convert(sample.svg, `${sample.label}.svg`, options)}
              >
                {sample.label}
              </button>
            ))}
          </div>

          <h3>Options</h3>
          <div className="options">
            {(
              [
                ['preserveGroups', 'Emit Fabric Groups instead of a flat list'],
                ['includeHidden', 'Keep hidden layers, marked hidden'],
                ['emitArtboard', 'Prepend a page rect named “clip”'],
                ['allowExternalResources', 'Permit other-origin images'],
              ] as const
            ).map(([key, hint]) => (
              <label key={key} title={hint}>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(event) => updateOption(key, event.target.checked)}
                />
                <code>{key}</code>
              </label>
            ))}

            <label className="scale" title="Applied at parse time, so path data stays exact">
              <code>scale</code>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={options.scale}
                onChange={(event) => updateOption('scale', Number(event.target.value))}
              />
              <span>{options.scale}×</span>
            </label>
          </div>

          {error && <p className="error">{error}</p>}
        </section>

        {/* ----------------------------- canvas ----------------------------- */}
        <section className="panel">
          <h2>
            2 · Canvas
            {result && (
              <em>
                {Math.round(result.document.width)} × {Math.round(result.document.height)}
                {elapsed !== null && ` · ${elapsed.toFixed(0)} ms`}
              </em>
            )}
          </h2>

          <div className="stage" style={{ minHeight: VIEWPORT.height }}>
            <canvas ref={canvasElement} />
            {!result && !busy && <p className="empty">Nothing loaded yet</p>}
            {busy && <p className="empty">Converting…</p>}
          </div>

          {result && result.warnings.length > 0 && (
            <div className="warnings">
              <h3>Warnings ({result.warnings.length})</h3>
              <ul>
                {result.warnings.map((warning, index) => (
                  <li key={index} className={`w-${warning.severity}`}>
                    <code>{warning.code}</code> {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ----------------------------- layers ----------------------------- */}
        <section className="panel">
          <h2>
            3 · Layers{result && <em>{layerCount} nodes</em>}
          </h2>

          {result ? (
            <LayerTree
              nodes={result.document.children}
              selectedId={selectedId}
              hiddenIds={hiddenIds}
              onSelect={selectLayer}
              onToggleVisible={toggleVisible}
            />
          ) : (
            <p className="empty">The layer tree appears here</p>
          )}
        </section>

        {/* ------------------------------ json ------------------------------ */}
        <section className="panel json-panel">
          <h2>
            4 · Fabric JSON
            {result && (
              <em>
                {result.fabricJson.objects.length} top-level ·{' '}
                {(new Blob([json]).size / 1024).toFixed(1)} kB
              </em>
            )}
          </h2>

          {result ? (
            <>
              <div className="json-actions">
                <button onClick={() => void navigator.clipboard.writeText(json)}>Copy</button>
                <button onClick={download}>Download .json</button>
              </div>
              <pre className="json">{json}</pre>
            </>
          ) : (
            <p className="empty">The JSON your editor consumes appears here</p>
          )}
        </section>
      </div>
    </div>
  );
}
