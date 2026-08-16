import type { SvgDesign, SvgNode } from './types/document.js';
import type {
  ConversionResult,
  ConvertOptions,
} from './types/options.js';
import type { FabricObjectJson } from './types/fabric.js';
import { WarningCollector } from './utils/warnings.js';
import { ProgressReporter } from './utils/progress.js';
import {
  DEFAULT_MAX_FILE_BYTES,
  parseSvgText,
  readSvgInput,
  resolveSize,
  type SvgInput,
} from './svg/readSvg.js';
import { sanitizeSvgDocument } from './svg/sanitize.js';
import { buildDomTree, buildLayerTree, type FabricObjectLike } from './svg/layerTree.js';
import { convertTree } from './svg/convert.js';
import { applyObjectNames, buildFabricJson } from './fabric/serialize.js';
import { applyOrigin } from './fabric/origin.js';

/* --------------------------------- types ---------------------------------- */

export type {
  SvgDesign,
  SvgNode,
  SvgNodeType,
  SvgBounds,
  SvgViewBox,
} from './types/document.js';
export type {
  ConvertOptions,
  ConversionResult,
  ConversionAsset,
  ConversionWarning,
  ConversionWarningCode,
  ConversionProgress,
  ConversionPhase,
} from './types/options.js';
export type {
  FabricJson,
  FabricObjectJson,
  AcetrumObjectMeta,
  AcetrumDocumentMeta,
} from './types/fabric.js';
export { ACETRUM_PROP, ACETRUM_SCHEMA_VERSION } from './types/fabric.js';
export type { SvgInput } from './svg/readSvg.js';

/* ------------------------------- host side -------------------------------- */

export { registerAcetrumProperties } from './fabric/customProperties.js';
export { loadIntoFabric, addToFabric } from './fabric/load.js';
export { inlineImages, hasExternalAssets, blobToDataUrl } from './fabric/persist.js';
export { applyOrigin } from './fabric/origin.js';
export type { Origin } from './fabric/origin.js';
export { GENERATOR, HOMEPAGE, buildFabricJson, applyObjectNames } from './fabric/serialize.js';
export { flattenTree, findNode } from './tree.js';

const DEFAULT_MAX_ELEMENTS = 50_000;

/**
 * The shape of Fabric's SVG parser this package depends on. Declared rather
 * than imported so nothing here forces `fabric` to load.
 */
interface SvgParsingOutput {
  objects: (FabricObjectLike | null)[];
  options: Record<string, unknown>;
  elements: Element[];
  allElements: Element[];
}

/**
 * Read an SVG's layer structure without converting anything.
 *
 * Fast, and safe to call anywhere — it never imports Fabric and never needs a
 * canvas, so it runs on a server. Nothing is measured, so every node's `bounds`
 * is zero; use `convertSvgToFabric` when the geometry matters.
 */
export async function parseSvg(
  input: SvgInput,
  options: Pick<
    ConvertOptions,
    'maxFileBytes' | 'sanitize' | 'allowExternalResources' | 'fallbackSize' | 'maxDocumentPixels'
  > = {},
): Promise<SvgDesign> {
  const warnings = new WarningCollector();
  const { text, fileName, fileSize } = await readSvgInput(
    input,
    options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
  );

  const root = parseSvgText(text);
  if (options.sanitize ?? true) {
    sanitizeSvgDocument(root, {
      allowExternalResources: options.allowExternalResources ?? false,
    });
  }

  const size = resolveSize(root, options, warnings);

  return {
    id: 'svg-root',
    width: size.width,
    height: size.height,
    ...(size.viewBox ? { viewBox: size.viewBox } : {}),
    children: buildDomTree(root),
    source: { fileSize, ...(fileName ? { fileName } : {}) },
  };
}

/**
 * Convert an SVG into Fabric JSON, with its group hierarchy intact.
 *
 * The geometry comes from Fabric's own SVG parser, which is the right tool for
 * it — it already resolves the CSS cascade, `<use>` references, gradient units,
 * nested transforms and the viewBox. What it does not do is preserve structure:
 * it hands back a flat list with every ancestor transform baked in. This
 * function pairs that list back up with the elements it came from and rebuilds
 * the tree, which is the part an editor's layers panel needs.
 *
 * Runs in the browser. Fabric is imported dynamically, so importing this module
 * during server rendering is harmless — but the conversion itself needs a DOM.
 */
export async function convertSvgToFabric(
  input: SvgInput,
  options: ConvertOptions = {},
): Promise<ConversionResult> {
  const warnings = new WarningCollector();
  const progress = new ProgressReporter(options.onProgress);
  progress.phase('parsing');

  const { text, fileName, fileSize } = await readSvgInput(
    input,
    options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
  );

  const root = parseSvgText(text);

  progress.phase('sanitizing');
  if (options.sanitize ?? true) {
    const report = sanitizeSvgDocument(root, {
      allowExternalResources: options.allowExternalResources ?? false,
    });

    if (report.foundActiveContent) {
      warnings.add(
        'SCRIPT_REMOVED',
        `Active content was removed before parsing: ${report.removed.join(', ')}. ` +
          'The file contained markup that would have executed.',
        'warning',
      );
    } else if (report.removed.length > 0) {
      warnings.info('UNSUPPORTED_FEATURE', `Ignored: ${report.removed.join(', ')}.`);
    }

    for (const url of report.externalRefs) {
      warnings.add(
        'EXTERNAL_REFERENCE',
        `A reference to ${truncate(url)} was dropped. Set allowExternalResources: true ` +
          'to keep references to other origins.',
        'warning',
      );
    }
  }

  reportUnsupported(root, warnings);

  const size = resolveSize(root, options, warnings);

  // Normalize the root so Fabric lays the document out at exactly the size
  // resolved above. Writing an explicit viewBox is what makes `scale` work:
  // Fabric derives its own transform from the viewBox-to-width/height ratio, so
  // a scaled width with a fixed viewBox scales the artwork rather than cropping
  // it — which is not something an after-the-fact transform on each object
  // could do without multiplying through every nested matrix.
  const scale = options.scale ?? 1;
  const viewBox = size.viewBox ?? {
    x: 0,
    y: 0,
    width: size.width / scale,
    height: size.height / scale,
  };
  root.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  root.setAttribute('width', String(size.width));
  root.setAttribute('height', String(size.height));

  const serializer = (globalThis as { XMLSerializer?: typeof XMLSerializer }).XMLSerializer;
  if (!serializer) {
    throw new Error(
      'No XMLSerializer is available. This package runs in a browser; under Node, ' +
        'install jsdom and assign globalThis.XMLSerializer before converting.',
    );
  }
  const normalized = new serializer().serializeToString(root);

  progress.phase('building');

  const { loadSVGFromString } = (await import('fabric')) as unknown as {
    loadSVGFromString(
      svg: string,
      reviver?: (element: Element, object: unknown) => void,
      loadOptions?: { crossOrigin?: string; signal?: AbortSignal },
    ): Promise<SvgParsingOutput>;
  };

  const loadOptions: { crossOrigin?: string; signal?: AbortSignal } = {};
  if (options.crossOrigin) loadOptions.crossOrigin = options.crossOrigin;
  if (options.signal) loadOptions.signal = options.signal;

  const parsed = await loadSVGFromString(normalized, options.reviver, loadOptions);

  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  if (parsed.elements.length > maxElements) {
    throw new RangeError(
      `The file has ${parsed.elements.length} drawable elements, which exceeds the ` +
        `${maxElements} element limit. Raise options.maxElements if this file is expected.`,
    );
  }

  progress.phase('converting');
  progress.begin(parsed.elements.length);

  const tree = buildLayerTree(parsed.elements, parsed.objects, (element) => {
    warnings.info(
      'UNSUPPORTED_ELEMENT',
      `<${element.localName}> could not be converted and was left out.`,
    );
  });

  const preserveGroups = options.preserveGroups ?? false;
  const { objects, assets } = await convertTree(
    tree,
    {
      preserveGroups,
      includeHidden: options.includeHidden ?? true,
      setObjectName: options.setObjectName ?? true,
    },
    warnings,
    progress,
  );

  const design: SvgDesign = {
    id: 'svg-root',
    width: size.width,
    height: size.height,
    ...(size.viewBox ? { viewBox: size.viewBox } : {}),
    children: tree.map((entry) => entry.node),
    source: { fileSize, ...(fileName ? { fileName } : {}) },
  };

  const fabricJson = buildFabricJson({
    design,
    objects: objects as FabricObjectJson[],
    background: options.background,
    fabricVersion: options.fabricVersion,
    flattenedGroups: !preserveGroups,
    clipToDocument: options.clipToDocument ?? true,
    ...(options.emitArtboard
      ? { artboard: options.emitArtboard === true ? {} : options.emitArtboard }
      : {}),
  });

  if (options.setObjectName ?? true) applyObjectNames(fabricJson.objects);
  if (options.origin) applyOrigin(fabricJson, options.origin);

  progress.phase('done');
  return { fabricJson, document: design, assets, warnings: warnings.all() };
}

/**
 * Warn about features that survive parsing but will not look right.
 *
 * These are reported rather than approximated on purpose: a wrong-looking
 * import that says nothing is worse than one that names what it could not do.
 */
function reportUnsupported(root: Element, warnings: WarningCollector): void {
  const counts = new Map<string, number>();

  const note = (feature: string): void => {
    counts.set(feature, (counts.get(feature) ?? 0) + 1);
  };

  const visit = (element: Element): void => {
    const tag = element.localName.toLowerCase();
    if (tag === 'filter') note('SVG filters');
    if (tag === 'mask') note('masks');
    if (element.hasAttribute('mask')) note('masks');
    if (element.hasAttribute('filter')) note('SVG filters');
    if (/mix-blend-mode/i.test(element.getAttribute('style') ?? '')) note('mix-blend-mode');

    for (const child of Array.from(element.children)) visit(child);
  };
  visit(root);

  for (const [feature, count] of counts) {
    warnings.add(
      'UNSUPPORTED_FEATURE',
      `${feature} (${count} ${count === 1 ? 'use' : 'uses'}) have no Fabric equivalent and ` +
        'were not applied. The artwork under them still imports.',
      'warning',
    );
  }
}

function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

/** Re-exported so a host can type a tree walk without importing the module path. */
export type { SvgNode as LayerNode };
