# @acetrumtech/svg-to-fabric

[![npm](https://img.shields.io/npm/v/%40acetrumtech%2Fsvg-to-fabric?color=5b5bd6&label=npm)](https://www.npmjs.com/package/@acetrumtech/svg-to-fabric)
[![gzipped](https://img.shields.io/bundlephobia/minzip/%40acetrumtech%2Fsvg-to-fabric?color=5b5bd6&label=gzipped)](https://bundlephobia.com/package/@acetrumtech/svg-to-fabric)
[![types](https://img.shields.io/npm/types/%40acetrumtech%2Fsvg-to-fabric?color=5b5bd6)](https://www.npmjs.com/package/@acetrumtech/svg-to-fabric)
[![license](https://img.shields.io/npm/l/%40acetrumtech%2Fsvg-to-fabric?color=5b5bd6)](./LICENSE)

**[Live demo](https://acetrumtech.github.io/svg-to-fabric/)** ·
**[npm](https://www.npmjs.com/package/@acetrumtech/svg-to-fabric)** ·
[Installation](#installation) ·
[Framework support](#framework-support) ·
[API](#api-reference)

Turn an SVG into editable, **named** Fabric.js layers.

Fabric already ships an SVG parser, and it is a good one — it resolves the CSS
cascade, `<use>` references, gradient units, nested transforms and the viewBox.
What it hands back is a flat list of objects with every ancestor transform baked
in. That is exactly right for drawing, and useless for a layers panel: the `<g>`
structure the designer built is gone, and so are the names.

This package pairs that flat list back up with the elements it came from,
rebuilds the group hierarchy, names every layer the way its exporter meant it to
be named, and hands you either a nested Fabric `Group` tree or a flat list that
still knows where it came from.

---

## Installation

Published on npm as
**[`@acetrumtech/svg-to-fabric`](https://www.npmjs.com/package/@acetrumtech/svg-to-fabric)**.

```bash
npm install @acetrumtech/svg-to-fabric fabric
```

```bash
pnpm add @acetrumtech/svg-to-fabric fabric
```

```bash
yarn add @acetrumtech/svg-to-fabric fabric
```

```bash
bun add @acetrumtech/svg-to-fabric fabric
```

`fabric` is a **peer dependency**, listed separately on purpose: this package
uses *your* copy of Fabric rather than bundling its own. A second copy in the
bundle would break `instanceof` against your classes, and the objects this
package builds are meant to be yours.

| Requirement | |
|---|---|
| `fabric` | `>=7 <8` |
| Node | `>=20` (for tooling and `parseSvg`) |
| Module format | ESM only |
| Types | bundled — no `@types/…` package needed |

## Framework support

The package is framework-agnostic ESM with no framework imports at all, so it
works anywhere that can run ESM against a DOM. `fabric` is loaded with a dynamic
`import()`, which means importing this package during server rendering is safe —
nothing browser-only is evaluated until you actually convert.

| Environment | Support | What to know |
|---|---|---|
| **React** 18 / 19 | ✅ | Nothing special — call it from an event handler or effect |
| **Vite** | ✅ | Nothing special |
| **Next.js** (App or Pages Router) | ✅ | Mark the component that owns the canvas `'use client'`, or `dynamic(..., { ssr: false })`. `parseSvg` works in a server route |
| **Remix / React Router** | ✅ | Convert in a client-side effect |
| **Vue 3 / Nuxt** | ✅ | Nuxt: wrap the canvas in `<ClientOnly>` |
| **Svelte / SvelteKit** | ✅ | SvelteKit: convert inside `onMount` |
| **Angular** | ✅ | Convert outside SSR (`isPlatformBrowser`) |
| **Astro** | ✅ | Use a client-hydrated island (`client:only`) |
| **Plain JS** / `<script type="module">` | ✅ | See [Plain JavaScript](#plain-javascript) |
| **Web Worker** | ⚠️ | `convertSvgToFabric` needs a DOM, so no worker mode |
| **Node / SSR** | ⚠️ | `parseSvg` only; assign `globalThis.DOMParser` from jsdom |
| **React Native** | ❌ | No DOM and no canvas for Fabric to draw on |

The rule underneath the table: **anything with a DOM can convert; anything at
all can `parseSvg`.** Every SSR caveat above is the same caveat — do the
conversion in the browser.

---

## Contents

- [Installation](#installation)
- [Framework support](#framework-support)
- [At a glance](#at-a-glance)
- [Try it](#try-it)
- [Getting started](#getting-started)
  - [One-time setup](#one-time-setup)
  - [React / Vite](#react--vite)
  - [Next.js](#nextjs)
  - [Plain JavaScript](#plain-javascript)
- [The layer tree](#the-layer-tree)
  - [Where names come from](#where-names-come-from)
  - [Reading the tree without converting](#reading-the-tree-without-converting)
- [Flat or nested](#flat-or-nested)
- [API reference](#api-reference)
  - [convertSvgToFabric](#convertsvgtofabricinput-options)
  - [parseSvg](#parsesvginput-options)
  - [ConvertOptions](#convertoptions)
  - [ConversionResult](#conversionresult)
  - [SvgNode / SvgDesign](#svgnode--svgdesign)
  - [Metadata](#metadata)
  - [Canvas helpers](#canvas-helpers)
  - [Tree helpers](#tree-helpers)
  - [Persistence helpers](#persistence-helpers)
  - [Warnings](#warnings)
- [Recipes](#recipes)
- [Behaviour worth knowing](#behaviour-worth-knowing)
- [Security](#security)
- [Limitations](#limitations)
- [Compatibility](#compatibility)
- [Development](#development)
- [Support](#support)

---

## At a glance

```ts
import { convertSvgToFabric, addToFabric } from '@acetrumtech/svg-to-fabric';

const result = await convertSvgToFabric(file);

await addToFabric(canvas, result);   // objects onto your existing canvas
result.document.children;            // the layer tree, named and nested
result.fabricJson;                   // plain JSON you can store
result.warnings;                     // what could not be represented, and why
```

| | |
|---|---|
| **Input** | `File`, `Blob`, `string`, `ArrayBuffer`, `Uint8Array` |
| **Output** | Fabric JSON + a normalized document tree + warnings |
| **Runtime** | Browser. `parseSvg` also runs on a server. |
| **Bundle** | ~26 kB, ~9 kB gzipped. `fabric` stays external. |
| **Peer dep** | `fabric` ≥ 7 < 8 |

---

## Try it

### → [acetrumtech.github.io/svg-to-fabric](https://acetrumtech.github.io/svg-to-fabric/)

Drop an SVG and you get the canvas, the layer tree, the warnings and the Fabric
JSON side by side, with every option switchable live and the result reconverted
as you change them. Nothing is uploaded — the conversion runs entirely in your
browser, which is the same thing that makes the library work in the first place.

Run it locally to hack on the library itself:

```bash
npm install && npm run demo
```

The demo aliases the package to `src/`, so it hot-reloads on library edits.

Every push to `main` publishes it to GitHub Pages via
`.github/workflows/deploy-demo.yml`, which typechecks and tests the library
first — a library that does not compile is a demo that must not ship. The
workflow builds with `DEMO_BASE=/svg-to-fabric/`, because a project site is
served from `/<repo>/` rather than the domain root; local builds default to `/`.

---

## Getting started

### One-time setup

Fabric restores unknown properties on load but drops them on `toObject()`.
Without this call your layer names and metadata survive the import and then
vanish the first time the editor saves — the panel works until the user
reloads, which is the worst way to find out.

```ts
import { FabricObject } from 'fabric';
import { registerAcetrumProperties } from '@acetrumtech/svg-to-fabric';

registerAcetrumProperties(FabricObject); // also registers `name`
```

Call it once, at editor start-up.

### React / Vite

```tsx
import { useRef } from 'react';
import type { Canvas } from 'fabric';
import { convertSvgToFabric, addToFabric } from '@acetrumtech/svg-to-fabric';

export function ImportSvgButton({ canvas }: { canvas: Canvas }) {
  const input = useRef<HTMLInputElement>(null);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = ''; // let the same file be picked twice

    try {
      const result = await convertSvgToFabric(file);
      await addToFabric(canvas, result);

      for (const warning of result.warnings) {
        console.warn(`[${warning.code}]`, warning.message);
      }
    } catch (error) {
      // Thrown only for input that should not be accepted at all —
      // see "Warnings" for the difference.
      alert(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <button onClick={() => input.current?.click()}>Import SVG</button>
      <input
        ref={input}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        onChange={onPick}
      />
    </>
  );
}
```

### Next.js

Importing this package on the server is safe — `fabric` is loaded with a dynamic
`import()`, so nothing browser-only is evaluated until you actually convert. The
conversion itself needs a DOM, so keep the component that owns the canvas
client-side:

```tsx
'use client';

import { convertSvgToFabric, addToFabric } from '@acetrumtech/svg-to-fabric';
// …
```

Or, if the editor component itself must not be server-rendered:

```tsx
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('./Editor'), { ssr: false });
```

`parseSvg` has no such restriction — it never touches Fabric or a canvas, so a
server route can read an uploaded file's layer names before anything reaches the
browser:

```ts
// app/api/inspect/route.ts
import { parseSvg } from '@acetrumtech/svg-to-fabric';

export async function POST(request: Request) {
  const design = await parseSvg(await request.text());
  return Response.json({ layers: design.children.length });
}
```

Node has no `DOMParser`, so install `jsdom` and assign the globals once at
start-up if you take this route:

```ts
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
```

### Plain JavaScript

```html
<script type="module">
  import { Canvas, FabricObject } from 'fabric';
  import {
    convertSvgToFabric,
    loadIntoFabric,
    registerAcetrumProperties,
  } from '@acetrumtech/svg-to-fabric';

  registerAcetrumProperties(FabricObject);

  const canvas = new Canvas('c');
  const result = await convertSvgToFabric(await fetch('/logo.svg').then((r) => r.text()));
  await loadIntoFabric(canvas, result);
</script>
```

---

## The layer tree

`result.document` is the SVG's real structure — every `<g>` is a group the
author made on purpose, which is more than a PSD or an `.ai` file can promise.

```
Card                 ← <g data-name="Card">
├─ Background        ← <rect>
├─ Badge             ← <g data-name="Badge">
│  ├─ Dot            ← <circle>
│  └─ Tick           ← <path>
└─ Bars              ← <g data-name="Bars">
   ├─ Bar 1
   ├─ Bar 2
   └─ Bar 3
```

The tree is in **paint order** — first entry drawn first, so furthest back.
A layers panel conventionally shows the top layer first, so reverse it for
display.

### Where names come from

The order is not arbitrary — it is what the three exporters that matter actually
write:

| Priority | Attribute | Who writes it | Why it has to win where it does |
|---|---|---|---|
| 1 | `data-name` | Figma | Figma mangles `id` into `Vector_3` |
| 2 | `inkscape:label` | Inkscape | `id` is a generated `path1234` |
| 3 | `id` | Illustrator | the layer name goes straight in |
| 4 | `<title>` | any | accessibility text, often a sentence |
| 5 | `aria-label` | any | last resort |
| 6 | `Path 3`, `Group 2` | — | generated fallback |

Names are stripped of control characters and capped at 256 characters — they
come from an untrusted file and end up in your DOM.

### Reading the tree without converting

`parseSvg` walks the DOM only. No Fabric import, no canvas, no measurement — so
it is fast and it runs on a server. The trade is that every node reports zero
bounds.

```ts
const design = await parseSvg(svgString);
design.children;  // same shape, bounds all zero
design.width;     // resolved the same way
```

---

## Flat or nested

**Flat is the default**, matching what most editors expect from an import:

```ts
result.fabricJson.objects; // [Rect, Circle, Path, …] in paint order
```

The hierarchy is not lost. Every object carries its ancestor ids:

```ts
object.acetrum.sourcePath; // ['layer-0', 'layer-0.1']
```

…so a host that only kept the Fabric JSON can still rebuild the tree. Or ask for
real Fabric groups:

```ts
await convertSvgToFabric(file, { preserveGroups: true });
// objects: [Group { objects: [Rect, Group { objects: [Circle, Path] }] }]
```

Grouping does not move anything. Fabric's parser has already pushed ancestor
transforms down onto the leaves, so `new Group(children)` measures what it is
given and re-parents it in place — the canvas renders pixel-identically either
way.

---

## API reference

### `convertSvgToFabric(input, options?)`

```ts
function convertSvgToFabric(
  input: string | ArrayBuffer | Uint8Array | Blob | File,
  options?: ConvertOptions,
): Promise<ConversionResult>;
```

Converts an SVG into Fabric JSON with its group hierarchy intact. Runs in the
browser; needs a DOM.

**Throws** for input that should not be accepted at all — over the byte limit,
over the pixel limit, over the element limit, not valid XML, or not an `<svg>`
root. Everything else becomes a warning.

### `parseSvg(input, options?)`

```ts
function parseSvg(
  input: string | ArrayBuffer | Uint8Array | Blob | File,
  options?: Pick<
    ConvertOptions,
    'maxFileBytes' | 'sanitize' | 'allowExternalResources' | 'fallbackSize' | 'maxDocumentPixels'
  >,
): Promise<SvgDesign>;
```

Reads the layer structure without converting anything. Never imports Fabric,
never needs a canvas. All bounds are zero.

### `ConvertOptions`

| Option | Type | Default | What it does |
|---|---|---|---|
| `preserveGroups` | `boolean` | `false` | Emit Fabric `Group`s instead of a flat list |
| `includeHidden` | `boolean` | `true` | Keep hidden elements, as `visible: false` |
| `sanitize` | `boolean` | `true` | Strip scripts, handlers, `javascript:` URLs |
| `allowExternalResources` | `boolean` | `false` | Permit `<image>`/`<use>` pointing at another origin |
| `scale` | `number` | `1` | Scale the document at parse time |
| `origin` | `{left,top}` | `{0,0}` | Offset everything onto an artboard that lives elsewhere |
| `emitArtboard` | `boolean \| {name,id,fill}` | `false` | Prepend a non-selectable page rect named `clip` |
| `clipToDocument` | `boolean` | `true` | Canvas-level clip at the document edges |
| `setObjectName` | `boolean` | `true` | Copy the layer name onto `object.name` |
| `background` | `string` | — | Canvas background; omitted unless set |
| `fabricVersion` | `string` | `'7.0.0'` | Written to the JSON `version` field |
| `fallbackSize` | `{width,height}` | `300×150` | Used only when there is no size *and* no viewBox |
| `crossOrigin` | `'anonymous' \| 'use-credentials'` | — | Passed to Fabric when it loads an `<image>` |
| `signal` | `AbortSignal` | — | Abort a conversion still loading images |
| `reviver` | `(element, object) => void` | — | Called after each element is converted |
| `onProgress` | `(progress) => void` | — | Monotonic `ratio`, never goes backwards |
| `maxFileBytes` | `number` | 32 MB | Checked before decoding |
| `maxDocumentPixels` | `number` | 100 M | Rejects absurd `scale` values |
| `maxElements` | `number` | 50 000 | Rejects pathological files |

A few of these deserve a sentence:

**`scale`** is a parse-time option on purpose. Scaling objects afterwards
multiplies through every nested transform; rewriting the root's width against a
fixed viewBox scales the artwork with the path data left exact. An icon authored
at 24×24 is unusable as a 24px object on a 1080p artboard.

**`origin`** exists because an SVG starts at (0, 0) and an editor's artboard
usually does not — a workspace canvas with the page centred inside it puts the
artboard at something like (402, −194). Pass that artboard's `left`/`top` and
the objects land on the page instead of beside it.

**`emitArtboard`** matters for editors that model the page as a non-selectable
rectangle at the bottom of the stack — conventionally named `clip` — and find it
by name to drive zoom-to-fit, page resize and export. Without one, a loaded
document has no page as far as the host is concerned.

**`clipToDocument`** makes the JSON describe its own artboard, so it renders the
same whatever size canvas it lands on. Turn it off if your editor deliberately
shows the area around the artboard, or adds its own objects to the same canvas —
a canvas clip applies to everything on it.

### `ConversionResult`

```ts
interface ConversionResult {
  fabricJson: FabricJson;          // ready for loadFromJSON / enlivenObjects
  document: SvgDesign;             // the normalized layer tree
  assets: ConversionAsset[];       // images the file referenced
  warnings: ConversionWarning[];   // what could not be represented
}

interface ConversionAsset {
  id: string;
  url: string;      // the string the object's `src` points at
  width: number;
  height: number;
  external: boolean; // leaves this origin, and so may taint the canvas
}
```

Nothing is re-encoded — an SVG's images are already `data:` URLs or URLs, so
`assets` is a manifest rather than an extraction.

### `SvgNode` / `SvgDesign`

```ts
interface SvgNode {
  id: string;            // deterministic: 'layer-0.1.2'
  name: string;
  type: 'group' | 'path' | 'shape' | 'text' | 'image' | 'unknown';
  tagName: string;       // 'g', 'path', 'rect', 'text'…
  sourceId?: string;     // the element's own id attribute
  visible: boolean;
  opacity: number;       // as authored — see below
  bounds: { left: number; top: number; width: number; height: number };
  children?: SvgNode[];
  objectIndex?: number;
  unsupported?: string[];
}

interface SvgDesign {
  id: string;
  width: number;
  height: number;
  viewBox?: { x: number; y: number; width: number; height: number };
  children: SvgNode[];
  source?: { fileName?: string; fileSize?: number };
}
```

`id` is derived from the node's position in the tree, never from a counter or a
random source — re-importing the same file produces byte-identical JSON, so a
host that diffs two imports gets no spurious changes.

`opacity` is the **authored** value, not the effective one. Fabric's parser
multiplies ancestor opacity into each object, so the Fabric objects carry the
folded-in number; the tree carries what the designer typed, which is what a
layers panel should show next to a group.

`bounds` are in canvas coordinates, after the viewBox transform. A group's box
is the union of its children's.

### Metadata

Everything this package adds lives under one namespaced key, exported as
`ACETRUM_PROP` (`'acetrum'`).

```ts
interface AcetrumObjectMeta {
  sourceLayerId: string;
  sourceLayerName: string;
  sourceType: string;     // the SvgNode type
  sourceTag: string;      // the SVG tag, lowercased
  sourceId?: string;      // the element's own id attribute
  sourcePath?: string[];  // ancestor group ids, outermost first
  unsupported?: string[];
}

interface AcetrumDocumentMeta {
  schemaVersion: number;  // ACETRUM_SCHEMA_VERSION
  source: 'svg';
  generator: string;      // GENERATOR
  homepage: string;       // HOMEPAGE
  document: { width: number; height: number; fileName?: string };
  flattenedGroups: boolean;
}
```

Object metadata sits on each object; document metadata sits on
`result.fabricJson.acetrum`.

### Canvas helpers

```ts
addToFabric(canvas, result): Promise<unknown[]>
```
Adds the result's objects to a canvas that already has content, and returns the
objects it added. **This is the one an editor wants** — importing artwork should
not throw away the user's document. The canvas-level `clipPath` and background
from the result are deliberately ignored, since they describe a whole page.

```ts
loadIntoFabric(canvas, result): Promise<void>
```
Replaces the canvas contents entirely, clip and background included. Right for a
viewer or a demo, wrong for an importer.

```ts
registerAcetrumProperties(FabricObject, extra?: string[]): void
```
Teaches the host's Fabric to keep the metadata through `toObject()`. Registers
`'name'` too unless you pass a different `extra`.

```ts
applyOrigin(fabricJson, { left, top }): void
```
Shifts a finished document. Only top-level objects, the document clip, and
`absolutePositioned` clipPaths move — group children are stored relative to
their group's centre, so shifting them too would double the offset.

```ts
buildFabricJson(input): FabricJson
applyObjectNames(objects): void
```
The serializer, exported for hosts assembling their own documents.

### Tree helpers

```ts
flattenTree(nodes: readonly SvgNode[]): SvgNode[]
findNode(nodes: readonly SvgNode[], id: string): SvgNode | undefined
```

### Persistence helpers

```ts
hasExternalAssets(fabricJson): boolean
inlineImages(result, options?): Promise<{ result: ConversionResult; failed: string[] }>
blobToDataUrl(blob): Promise<string>
```

An SVG's `<image>` is usually a `data:` URL and needs nothing. When it is a URL,
saved JSON renders every path while the photo comes up empty the day that URL
moves — and, before that, taints the canvas so `toDataURL()` throws.

`inlineImages` fetches each one and rewrites it as a `data:` URL. It makes
network requests, which is why conversion never does it for you. Options:
`timeoutMs` (15 000), `maxBytes` (8 MB), `fetchImpl`. An image that cannot be
fetched is left as it was and listed in `failed` — a document with one remote
photo still beats a rejected save.

### Warnings

Conversion never throws for an element it cannot handle. It records a warning
and carries on: a file with one unreadable `<filter>` should still import.

```ts
interface ConversionWarning {
  code: ConversionWarningCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  layerId?: string;
  layerName?: string;
}
```

| Code | Means |
|---|---|
| `SCRIPT_REMOVED` | The file carried something that would have executed. **Surface this.** |
| `EXTERNAL_REFERENCE` | A reference to another origin was dropped, or will taint the canvas |
| `UNSUPPORTED_FEATURE` | Filters, masks, `mix-blend-mode` — reported, not applied |
| `UNSUPPORTED_ELEMENT` | Fabric's parser could not turn an element into an object |
| `ELEMENT_SKIPPED` | Deliberately left out, e.g. an image with no usable source |
| `SIZE_ASSUMED` | No usable width/height or viewBox, so a size was assumed |
| `PARSE_RECOVERED` | Malformed, but enough parsed to continue |

---

## Recipes

### A layers panel

```tsx
function Layers({ nodes, canvas }: { nodes: readonly SvgNode[]; canvas: Canvas }) {
  const select = (node: SvgNode) => {
    const all = canvas.getObjects().flatMap(function walk(o): FabricObject[] {
      const kids = (o as { _objects?: FabricObject[] })._objects;
      return kids ? [o, ...kids.flatMap(walk)] : [o];
    });

    const exact = all.find((o) => o.acetrum?.sourceLayerId === node.id);
    if (exact) {
      canvas.setActiveObject(exact);
    } else {
      // A group row with no object of its own — which is what flattening means.
      const kids = all.filter((o) => o.acetrum?.sourcePath?.includes(node.id));
      if (kids.length) canvas.setActiveObject(new ActiveSelection(kids, { canvas }));
    }
    canvas.requestRenderAll();
  };

  // Reversed: the tree is in paint order, panels list the top layer first.
  return (
    <ul>
      {[...nodes].reverse().map((node) => (
        <li key={node.id}>
          <button onClick={() => select(node)}>{node.name}</button>
          {node.children && <Layers nodes={node.children} canvas={canvas} />}
        </li>
      ))}
    </ul>
  );
}
```

### Re-nest a flat list

```ts
function nest(objects: FabricObjectJson[]) {
  const roots: Record<string, unknown[]> = { '': [] };

  for (const object of objects) {
    const path = object.acetrum?.sourcePath ?? [];
    const key = path.join('/');
    (roots[key] ??= []).push(object);
  }
  return roots;
}
```

### Toggle a whole group's visibility

```ts
const ids = new Set([node.id, ...flattenTree(node.children ?? []).map((n) => n.id)]);

for (const object of canvas.getObjects()) {
  const meta = object.acetrum;
  if (ids.has(meta?.sourceLayerId) || meta?.sourcePath?.includes(node.id)) {
    object.set('visible', false);
  }
}
canvas.requestRenderAll();
```

### Import onto an artboard that is not at (0, 0)

```ts
const artboard = canvas.getObjects().find((o) => o.name === 'clip');

await convertSvgToFabric(file, {
  origin: { left: artboard.left, top: artboard.top },
  clipToDocument: false, // the host already owns its artboard clip
});
```

### Progress for a large file

```ts
await convertSvgToFabric(file, {
  onProgress: ({ phase, ratio, layerName }) => {
    setLabel(`${phase}${layerName ? ` · ${layerName}` : ''}`);
    setBar(ratio); // monotonic; safe to drive a progress bar directly
  },
});
```

Phases, in order: `parsing`, `sanitizing`, `building`, `converting`, `done`.

### Save it

```ts
const { result: safe, failed } = hasExternalAssets(result.fabricJson)
  ? await inlineImages(result)
  : { result, failed: [] };

if (failed.length) console.warn('Could not inline:', failed);
await fetch('/api/documents', { method: 'POST', body: JSON.stringify(safe.fabricJson) });
```

---

## Behaviour worth knowing

**Objects come back on a centre origin.** Fabric's SVG parser sets
`originX: 'center'`, `originY: 'center'`, so `left`/`top` are the object's
*centre*, not its top-left corner. A host that assumes top-left will place every
imported object half its own size off. This package leaves the origin alone
rather than rewriting it, because rewriting it changes what `left` means for
objects your editor may already be positioning by hand.

Nested positions are therefore just the sum of the `left` values:

```ts
const absoluteLeft = group.left + child.left; // no width/2 anywhere
```

**Hidden layers** are handled the way you would want: `display: none`,
`visibility: hidden` and a hidden `<g>` all come through as `visible: false`,
and `includeHidden: false` drops them — a hidden group taking its children with
it.

**`<defs>`, `<clipPath>`, `<mask>`, `<symbol>`, `<pattern>` and gradients are
not mistaken for layers.** They define things for later reference; walking into
them would invent layers the designer never made.

**An empty `<g>` is not a layer.** A group that turned out to hold nothing
drawable is scaffolding from an exporter, and is dropped from the tree.

**An `<image>` with no usable source is dropped from the canvas but kept in the
tree**, marked `unsupported: ['image source unavailable']`. It would render
nothing and never could, but the file did have an image there and the panel
should say so.

---

## Security

An SVG is markup, and markup that reaches a DOM runs. This is the one concern an
SVG importer has that a PSD or `.ai` importer does not — those are binary
formats whose bytes never become markup. A user uploading a logo to your editor
is exactly the untrusted-input case.

Sanitization is on by default and removes:

- `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<handler>`,
  `<listener>`
- every `on*` event handler attribute — the prefix test is complete, because SVG
  defines no drawing attribute starting with `on`
- `javascript:`, `vbscript:`, `livescript:` and `mocha:` URLs
- `data:` URLs that are not images, since a non-image `data:` URL is a document
  and a document can script
- SMIL animation elements — `<animate attributeName="href" values="javascript:…">`
  is a known way past a filter that only checked static attributes
- `@import`, `expression()` and `url(javascript:…)` inside `<style>`
- references to other origins, unless `allowExternalResources: true`

Parsing goes through `image/svg+xml`, never the lenient HTML parser: the HTML
parser reinterprets tags, lowercases `viewBox` into `viewbox`, and can resurrect
markup a sanitizer expected to be inert.

Anything removed becomes a warning. A `SCRIPT_REMOVED` warning means the file
contained something that would have executed — surface it:

```ts
const active = result.warnings.filter((w) => w.code === 'SCRIPT_REMOVED');
if (active.length) showBanner('This file contained active content, which was removed.');
```

Byte, pixel and element limits are enforced before the expensive work, so a
zip-bomb-shaped SVG is rejected rather than parsed.

This is defence in depth, not a licence to skip a CSP.

---

## Limitations

- **SVG filters and masks are reported, not applied.** Canvas has no equivalent.
  The artwork under them still imports; you get an `UNSUPPORTED_FEATURE` warning
  naming how many uses were found.
- **`mix-blend-mode` is reported, not applied.**
- **Group opacity is an approximation.** Fabric multiplies group alpha into each
  child rather than compositing the group first, so overlapping children inside a
  faded group look different from a browser.
- **Fonts are matched by name.** An SVG references fonts, it does not embed them
  — text renders with whatever the browser resolves.
- **No worker mode.** Fabric's SVG parser needs a DOM. SVGs are small enough that
  this has not been a problem.
- **SMIL animation is removed, not played.** Fabric cannot animate SVG timelines,
  and the elements are an injection vector.

---

## Compatibility

| | |
|---|---|
| Fabric | ≥ 7.0.0 < 8.0.0 (peer dependency — your copy is used, never a second one) |
| Node | ≥ 20, for `parseSvg` and tooling |
| Browsers | Anything with `DOMParser`, `XMLSerializer` and ES2022 |
| Module format | ESM only |
| Types | Bundled, no `@types` package needed |

---

## Development

```bash
npm install
npm run demo          # Vite playground at :5173
npm test              # vitest, jsdom
npm run typecheck
npm run build         # dist/ — ESM + .d.ts
```

Source layout:

```
src/
  svg/
    sanitize.ts   strip everything active, before anything parses
    readSvg.ts    input normalization, parsing, size resolution
    layerTree.ts  rebuild the hierarchy from Fabric's flat output
    convert.ts    tree → Fabric JSON, flat and nested
  fabric/         serialize, origin, load, persist, customProperties
  types/          document, fabric, options
  utils/          warnings, progress, ids, units
```

---

## Support

- Website — [acetrum.com](https://acetrum.com)
- Email — [info.acetrum@gmail.com](mailto:info.acetrum@gmail.com)

## License

MIT
