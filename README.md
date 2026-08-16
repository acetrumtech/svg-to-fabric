# @acetrumtech/svg-to-fabric

Turn an SVG into editable, **named** Fabric.js layers.

Fabric already ships an SVG parser, and it is a good one — it resolves the CSS
cascade, `<use>` references, gradient units, nested transforms and the viewBox.
What it hands back is a flat list of objects with every ancestor transform baked
in. That is exactly right for drawing, and useless for a layers panel: the
`<g>` structure the designer built is gone, and so are the names.

This package pairs that flat list back up with the elements it came from,
rebuilds the group hierarchy, names every layer the way its exporter meant it to
be named, and hands you either a nested Fabric `Group` tree or a flat list that
still knows where it came from.

```
npm install @acetrumtech/svg-to-fabric
```

`fabric` (v7) is a peer dependency — this package uses your copy, never its own.

---

## Try it

```bash
npm install && npm run demo
```

Drop an SVG (or click one of the built-in samples) and you get the canvas, the
layer tree, the warnings and the Fabric JSON side by side. The demo aliases the
package to `src/`, so it hot-reloads on library edits.

The samples are chosen to show something specific: a Figma export whose names
live in `data-name`, an Illustrator export whose names live in `id`, an Inkscape
export using `inkscape:label`, an icon with no width/height to try `scale` on,
and a hostile file carrying a script, an inline handler, a `javascript:` link, a
tracking pixel and a `<foreignObject>` — all of which come back stripped, with
the artwork intact.

## Quick start

```ts
import { convertSvgToFabric, addToFabric } from '@acetrumtech/svg-to-fabric';

const result = await convertSvgToFabric(file); // File | Blob | string | ArrayBuffer

await addToFabric(canvas, result); // adds to your existing canvas
console.log(result.document.children); // the layer tree
```

### React / Vite

```tsx
function ImportSvg({ canvas }: { canvas: fabric.Canvas }) {
  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await convertSvgToFabric(file, { emitArtboard: false });
    await addToFabric(canvas, result);

    for (const warning of result.warnings) console.warn(warning.code, warning.message);
  };

  return <input type="file" accept=".svg,image/svg+xml" onChange={onPick} />;
}
```

### Next.js

Importing this package on the server is safe — `fabric` is loaded with a dynamic
`import()`, so nothing browser-only is evaluated until you actually convert. The
conversion itself needs a DOM, so call it from an event handler or an effect,
and keep the component that owns the canvas client-side:

```tsx
'use client';
// or: const Editor = dynamic(() => import('./Editor'), { ssr: false })
```

`parseSvg` has no such restriction and runs anywhere — see below.

---

## Register the metadata once

Fabric restores unknown properties on load but drops them on `toObject()`. Without
this call your layer names and metadata survive the import and then vanish the
first time the editor saves — the panel works until the user reloads, which is
the worst way to find out.

```ts
import { FabricObject } from 'fabric';
import { registerAcetrumProperties } from '@acetrumtech/svg-to-fabric';

registerAcetrumProperties(FabricObject); // also registers `name`
```

---

## The layer tree

`result.document` is the SVG's real structure — every `<g>` is a group the
author made on purpose, which is more than a PSD or an `.ai` file can promise.

```ts
interface SvgNode {
  id: string;          // deterministic: layer-0.1.2
  name: string;        // see "Where names come from"
  type: 'group' | 'path' | 'shape' | 'text' | 'image' | 'unknown';
  tagName: string;     // 'g', 'path', 'rect'…
  sourceId?: string;   // the element's own id attribute
  visible: boolean;
  opacity: number;     // as authored — see the note below
  bounds: { left, top, width, height };  // canvas coordinates
  children?: SvgNode[];
  objectIndex?: number;
  unsupported?: string[];
}
```

Helpers: `flattenTree(nodes)` and `findNode(nodes, id)`.

### Where names come from

The order is not arbitrary — it is what the three exporters that matter actually
write:

| Source | Attribute | Why it has to win where it does |
|---|---|---|
| Figma | `data-name` | Figma mangles `id` into `Vector_3` |
| Inkscape | `inkscape:label` | `id` is a generated `path1234` |
| Illustrator | `id` | the layer name goes straight in |
| any | `<title>` | accessibility text, often a sentence — so it comes last but one |
| any | `aria-label` | last resort before `Path 3` |

### Reading the tree without converting

`parseSvg` walks the DOM only. No Fabric import, no canvas, no measurement — so
it is fast and it runs on a server. The trade is that every node reports zero
bounds.

```ts
const design = await parseSvg(svgString);
```

---

## Flat or nested

Default is **flat**, matching what most editors expect from an import:

```ts
result.fabricJson.objects; // [Rect, Circle, Path] in paint order
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

Grouping does not move anything: Fabric's parser has already pushed ancestor
transforms down onto the leaves, so `new Group(children)` measures what it is
given and re-parents it in place.

---

## Options

| Option | Default | What it does |
|---|---|---|
| `preserveGroups` | `false` | Emit Fabric `Group`s instead of a flat list |
| `includeHidden` | `true` | Keep hidden elements, as `visible: false` |
| `sanitize` | `true` | Strip scripts, handlers, `javascript:` URLs |
| `allowExternalResources` | `false` | Permit `<image>`/`<use>` pointing at another origin |
| `scale` | `1` | Scale the document at parse time, not afterwards |
| `origin` | `{0,0}` | Offset everything onto an artboard that lives elsewhere |
| `emitArtboard` | `false` | Prepend a non-selectable page rect named `clip` |
| `clipToDocument` | `true` | Canvas-level clip at the document edges |
| `setObjectName` | `true` | Copy the layer name onto `object.name` |
| `background` | — | Canvas background; omitted unless set |
| `fabricVersion` | `'7.0.0'` | Written to the JSON `version` field |
| `fallbackSize` | `300×150` | Used only when there is no size *and* no viewBox |
| `crossOrigin` | — | Passed to Fabric when it loads an `<image>` |
| `signal` | — | `AbortSignal` for a conversion still loading images |
| `reviver` | — | `(element, object) => void` after each element |
| `onProgress` | — | Monotonic `ratio`, never goes backwards |
| `maxFileBytes` | 32 MB | Checked before decoding |
| `maxDocumentPixels` | 100 M | Rejects absurd `scale` values |
| `maxElements` | 50 000 | Rejects pathological files |

`scale` is a parse-time option on purpose. Scaling objects afterwards multiplies
through every nested transform; rewriting the root's width against a fixed
viewBox scales the artwork with the path data left exact.

---

## One thing that will bite you

**Objects come back on a centre origin.** Fabric's SVG parser sets
`originX: 'center'`, `originY: 'center'`, so `left`/`top` are the object's
*centre*, not its top-left corner. A host that assumes top-left will place every
imported object half its own size off. This package leaves the origin alone
rather than rewriting it, because rewriting it changes what `left` means for
objects your editor may already be positioning by hand.

Hidden layers, for the record, are handled the way you would want: `display:
none`, `visibility: hidden` and a hidden `<g>` all come through as
`visible: false`, and `includeHidden: false` drops them — a hidden group taking
its children with it.

---

## Security

An SVG is markup, and markup that reaches a DOM runs. This is the one concern an
SVG importer has that a PSD or `.ai` importer does not — those are binary
formats whose bytes never become markup. A user uploading a logo to your editor
is exactly the untrusted-input case.

Sanitization is on by default and removes:

- `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<handler>`
- every `on*` event handler attribute
- `javascript:` / `vbscript:` URLs, and `data:` URLs that are not images
- SMIL animation elements — `<animate attributeName="href" values="javascript:…">`
  is a known way past a filter that only checked static attributes
- `@import` and `expression()` inside `<style>`
- references to other origins, unless `allowExternalResources: true`

Anything removed becomes a warning. A `SCRIPT_REMOVED` warning means the file
contained something that would have executed — surface it.

```ts
const active = result.warnings.filter((w) => w.code === 'SCRIPT_REMOVED');
```

This is defence in depth, not a licence to skip a CSP.

---

## Saving

An SVG's `<image>` is usually a `data:` URL and needs nothing. When it is a URL,
saved JSON renders every path while the photo comes up empty the day that URL
moves — and, before that, taints the canvas so `toDataURL()` throws.

```ts
import { hasExternalAssets, inlineImages } from '@acetrumtech/svg-to-fabric';

if (hasExternalAssets(result.fabricJson)) {
  const { result: safe, failed } = await inlineImages(result);
}
```

It makes network requests, which is why conversion never does it for you.

---

## Warnings

Conversion never throws for an element it cannot handle. Codes:
`UNSUPPORTED_ELEMENT`, `UNSUPPORTED_FEATURE`, `ELEMENT_SKIPPED`,
`SCRIPT_REMOVED`, `EXTERNAL_REFERENCE`, `SIZE_ASSUMED`, `PARSE_RECOVERED`.

It *does* throw for input it should not accept at all: over the byte limit, over
the pixel limit, over the element limit, not valid XML, or not an `<svg>` root.

---

## Limitations

- **SVG filters and masks are reported, not applied.** Canvas has no equivalent.
  The artwork under them still imports; you get an `UNSUPPORTED_FEATURE` warning
  naming how many uses were found.
- **`mix-blend-mode` is reported, not applied.**
- **Group opacity is an approximation.** Fabric multiplies group alpha into each
  child rather than compositing the group first, so overlapping children inside a
  faded group look different from a browser. `node.opacity` in the document tree
  is the *authored* value, which is what a layers panel should show; the Fabric
  objects carry the folded-in one.
- **Fonts are matched by name.** An SVG references fonts, it does not embed them
  — text renders with whatever the browser resolves.
- **Runs on the main thread.** Fabric's parser needs a DOM, so there is no worker
  mode. SVGs are small enough that this has not been a problem.

---

## License

MIT
