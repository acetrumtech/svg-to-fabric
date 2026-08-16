import { describe, expect, it } from 'vitest';
import { convertSvgToFabric, parseSvg, ACETRUM_PROP } from '../src/index.js';
import type { AcetrumObjectMeta, FabricObjectJson } from '../src/types/fabric.js';
import type { SvgNode } from '../src/types/document.js';
import * as fixtures from './fixtures.js';

const meta = (object: FabricObjectJson): AcetrumObjectMeta =>
  object[ACETRUM_PROP] as AcetrumObjectMeta;

const names = (nodes: readonly SvgNode[]): unknown[] =>
  nodes.map((node) => (node.children ? { [node.name]: names(node.children) } : node.name));

describe('layer tree', () => {
  it('rebuilds Figma group hierarchy from data-name', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);

    expect(names(result.document.children)).toEqual([
      { Card: ['Background', { Badge: ['Dot', 'Tick'] }] },
    ]);
  });

  it('prefers data-name over the mangled id Figma writes', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);
    const card = result.document.children[0]!;

    expect(card.name).toBe('Card');
    expect(card.sourceId).toBe('Frame_1');
  });

  it('falls back to id for Illustrator files', async () => {
    const result = await convertSvgToFabric(fixtures.ILLUSTRATOR);

    expect(names(result.document.children)).toEqual([
      { Background: ['Rect 1'] },
      { Logo: ['Left_Wing', 'Right_Wing'] },
    ]);
  });

  it('reads inkscape:label ahead of the generated id', async () => {
    const result = await convertSvgToFabric(fixtures.INKSCAPE);

    expect(result.document.children[0]?.name).toBe('Outlines');
    expect(result.document.children[0]?.children?.[0]?.name).toBe('rect938');
  });

  it('gives every node a deterministic id', async () => {
    const a = await convertSvgToFabric(fixtures.FIGMA);
    const b = await convertSvgToFabric(fixtures.FIGMA);

    expect(JSON.stringify(a.document)).toBe(JSON.stringify(b.document));
  });

  it('measures group bounds as the union of its children', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);
    const badge = result.document.children[0]?.children?.[1]!;

    expect(badge.name).toBe('Badge');
    // Dot spans x 20..40, Tick spans x 25..36 — the union starts at the dot.
    expect(Math.round(badge.bounds.left)).toBe(20);
    expect(Math.round(badge.bounds.top)).toBe(20);
  });
});

describe('flat vs grouped output', () => {
  it('flattens by default, keeping paint order', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);
    const objects = result.fabricJson.objects;

    expect(objects.map((object) => meta(object).sourceLayerName)).toEqual([
      'Background',
      'Dot',
      'Tick',
    ]);
    expect(result.fabricJson[ACETRUM_PROP].flattenedGroups).toBe(true);
  });

  it('records the ancestor chain so a flat list can be re-nested', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);
    const tick = result.fabricJson.objects[2]!;

    expect(meta(tick).sourcePath).toEqual(['layer-0', 'layer-0.1']);
  });

  it('emits real Groups with preserveGroups', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA, { preserveGroups: true });
    const objects = result.fabricJson.objects;

    expect(objects).toHaveLength(1);
    expect(objects[0]?.type).toBe('Group');
    expect(meta(objects[0]!).sourceLayerName).toBe('Card');

    const children = objects[0]?.objects as FabricObjectJson[];
    expect(children.map((child) => child.type)).toEqual(['Rect', 'Group']);
    expect(result.fabricJson[ACETRUM_PROP].flattenedGroups).toBe(false);
  });

  it('keeps metadata on children inside a group', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA, { preserveGroups: true });
    const card = result.fabricJson.objects[0]!;
    const badge = (card.objects as FabricObjectJson[])[1]!;
    const dot = (badge.objects as FabricObjectJson[])[0]!;

    expect(meta(dot).sourceLayerName).toBe('Dot');
    expect(dot.name).toBe('Dot');
  });

  it('does not move artwork when it groups it', async () => {
    const flat = await convertSvgToFabric(fixtures.FIGMA);
    const nested = await convertSvgToFabric(fixtures.FIGMA, { preserveGroups: true });

    const card = nested.fabricJson.objects[0]!;
    const badge = (card.objects as FabricObjectJson[])[1]!;
    const dotInGroup = (badge.objects as FabricObjectJson[])[0]!;
    const dotFlat = flat.fabricJson.objects[1]!;

    // Fabric's SVG parser gives every object `originX/originY: 'center'`, so
    // `left`/`top` are centres and a nested position is just the sum of them.
    const absoluteLeft =
      (card.left as number) + (badge.left as number) + (dotInGroup.left as number);
    const absoluteTop = (card.top as number) + (badge.top as number) + (dotInGroup.top as number);

    expect(absoluteLeft).toBeCloseTo(dotFlat.left as number, 4);
    expect(absoluteTop).toBeCloseTo(dotFlat.top as number, 4);
  });

  it('leaves objects on a centre origin, as Fabric’s SVG parser does', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);
    const background = result.fabricJson.objects[0]!;

    // Worth pinning: a host that assumes top-left origins will place every
    // imported object half its own size off.
    expect(background.originX).toBe('center');
    expect(background.originY).toBe('center');
    expect(background.left).toBe(100);
  });
});

describe('sizing', () => {
  it('uses the viewBox when width/height are absent', async () => {
    const result = await convertSvgToFabric(fixtures.VIEWBOX_ONLY);

    expect(result.document.width).toBe(24);
    expect(result.document.height).toBe(24);
  });

  it('converts physical units to pixels', async () => {
    const result = await convertSvgToFabric(fixtures.MILLIMETRES);

    // 10mm at 96dpi is 37.795…px.
    expect(result.document.width).toBeCloseTo(37.795, 2);
  });

  it('scales the document without touching object transforms', async () => {
    const plain = await convertSvgToFabric(fixtures.VIEWBOX_ONLY);
    const scaled = await convertSvgToFabric(fixtures.VIEWBOX_ONLY, { scale: 4 });

    expect(scaled.document.width).toBe(96);
    expect(scaled.fabricJson.objects[0]?.scaleX).toBeCloseTo(
      (plain.fabricJson.objects[0]?.scaleX as number) * 4,
      6,
    );
  });

  it('warns rather than guessing silently when there is no size', async () => {
    const result = await convertSvgToFabric(fixtures.NO_SIZE);

    expect(result.document.width).toBe(300);
    expect(result.warnings.map((warning) => warning.code)).toContain('SIZE_ASSUMED');
  });

  it('rejects a document bigger than the pixel limit', async () => {
    await expect(
      convertSvgToFabric(fixtures.VIEWBOX_ONLY, { scale: 1000, maxDocumentPixels: 1000 }),
    ).rejects.toThrow(/pixel limit/);
  });
});

describe('security', () => {
  it('strips every executable construct', async () => {
    const result = await convertSvgToFabric(fixtures.MALICIOUS);
    const json = JSON.stringify(result.fabricJson);

    expect(json).not.toMatch(/javascript:/i);
    expect(json).not.toMatch(/alert\(/);
    expect(json).not.toMatch(/evil\.example/);
  });

  it('says so, loudly, when it removed something active', async () => {
    const result = await convertSvgToFabric(fixtures.MALICIOUS);
    const removal = result.warnings.find((warning) => warning.code === 'SCRIPT_REMOVED');

    expect(removal).toBeDefined();
    expect(removal?.severity).toBe('warning');
  });

  it('drops other-origin references unless they are allowed', async () => {
    const result = await convertSvgToFabric(fixtures.MALICIOUS);

    expect(result.warnings.some((warning) => warning.code === 'EXTERNAL_REFERENCE')).toBe(true);
    expect(result.assets).toHaveLength(0);
  });

  it('still converts the artwork around the removed markup', async () => {
    const result = await convertSvgToFabric(fixtures.MALICIOUS);

    expect(result.fabricJson.objects.length).toBeGreaterThan(0);
  });

  it('leaves no dead image object behind when it strips an href', async () => {
    const result = await convertSvgToFabric(fixtures.MALICIOUS);

    // An Image with src '' renders nothing and never will, but would still be
    // selectable in the host's layers panel.
    expect(result.fabricJson.objects.some((object) => object.type === 'Image')).toBe(false);

    // It stays in the document tree, because the file did have an image there.
    const tracked = result.document.children.find((node) => node.type === 'image');
    expect(tracked?.unsupported).toContain('image source unavailable');
  });

  it('refuses a file over the byte limit before decoding it', async () => {
    await expect(
      convertSvgToFabric(fixtures.FIGMA, { maxFileBytes: 10 }),
    ).rejects.toThrow(/exceeds the 10 byte limit/);
  });

  it('rejects markup that is not SVG', async () => {
    await expect(convertSvgToFabric('<html><body>no</body></html>')).rejects.toThrow(
      /Expected an <svg> root/,
    );
  });
});

describe('host integration', () => {
  it('emits an artboard beneath the layers when asked', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA, { emitArtboard: true });
    const first = result.fabricJson.objects[0]!;

    expect(first.name).toBe('clip');
    expect(first.selectable).toBe(false);
    expect(first.width).toBe(200);
  });

  it('offsets everything onto an artboard that lives elsewhere', async () => {
    const plain = await convertSvgToFabric(fixtures.FIGMA);
    const moved = await convertSvgToFabric(fixtures.FIGMA, { origin: { left: 400, top: -200 } });

    expect(moved.fabricJson.objects[0]?.left).toBeCloseTo(
      (plain.fabricJson.objects[0]?.left as number) + 400,
      6,
    );
    expect((moved.fabricJson.clipPath as FabricObjectJson).left).toBe(400);
  });

  it('sets name on every object for the layers panel', async () => {
    const result = await convertSvgToFabric(fixtures.ILLUSTRATOR);

    expect(result.fabricJson.objects.map((object) => object.name)).toEqual([
      'Rect 1',
      'Left_Wing',
      'Right_Wing',
    ]);
  });

  it('reports itself as an SVG conversion', async () => {
    const result = await convertSvgToFabric(fixtures.FIGMA);

    expect(result.fabricJson[ACETRUM_PROP].source).toBe('svg');
    expect(result.fabricJson[ACETRUM_PROP].document.width).toBe(200);
  });
});

describe('visibility and structure', () => {
  it('keeps hidden layers, marked hidden, however they were hidden', async () => {
    const result = await convertSvgToFabric(fixtures.HIDDEN);
    const byName = new Map(result.document.children.map((node) => [node.name, node]));

    expect(byName.get('Shown')?.visible).toBe(true);
    expect(byName.get('Invisible')?.visible).toBe(false);
    expect(byName.get('Undisplayed')?.visible).toBe(false);
    expect(byName.get('HiddenGroup')?.visible).toBe(false);
  });

  it('drops hidden layers, and a hidden group’s children with it', async () => {
    const result = await convertSvgToFabric(fixtures.HIDDEN, { includeHidden: false });

    expect(result.fabricJson.objects.map((object) => object.name)).toEqual(['Shown']);
  });

  it('records a group opacity as authored, not as folded into children', async () => {
    const result = await convertSvgToFabric(fixtures.OPACITY_AND_DEFS);

    expect(result.document.children[0]?.opacity).toBe(0.5);
  });

  it('does not turn defs into layers', async () => {
    const result = await convertSvgToFabric(fixtures.OPACITY_AND_DEFS);

    expect(result.document.children).toHaveLength(1);
    expect(result.document.children[0]?.name).toBe('Faded');
  });
});

describe('parseSvg', () => {
  it('reads the tree without converting anything', async () => {
    const design = await parseSvg(fixtures.FIGMA);

    expect(names(design.children)).toEqual([
      { Card: ['Background', { Badge: ['Dot', 'Tick'] }] },
    ]);
    expect(design.width).toBe(200);
  });

  it('skips defs the same way the converter does', async () => {
    const design = await parseSvg(fixtures.OPACITY_AND_DEFS);

    expect(design.children).toHaveLength(1);
  });

  it('reports no bounds, because it measures nothing', async () => {
    const design = await parseSvg(fixtures.FIGMA);

    expect(design.children[0]?.bounds).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe('progress', () => {
  it('never goes backwards and ends at 1', async () => {
    const ratios: number[] = [];
    await convertSvgToFabric(fixtures.FIGMA, {
      onProgress: (progress) => ratios.push(progress.ratio),
    });

    expect(ratios.length).toBeGreaterThan(0);
    expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
    expect(ratios.at(-1)).toBe(1);
  });
});
