# Changelog

All notable changes to this project are documented here. This project follows
[semantic versioning](https://semver.org/).

## 0.1.0

First release.

### Conversion

- SVG → Fabric.js JSON via `convertSvgToFabric`, with the group hierarchy
  rebuilt from Fabric's flat parser output by pairing each object back up with
  the element it came from.
- Layer names read the way each exporter actually writes them: Figma's
  `data-name` ahead of its mangled `id`, Inkscape's `inkscape:label` ahead of its
  generated one, Illustrator's `id`, then `<title>` and `aria-label`.
- Flat output by default, with each object carrying its ancestor ids in
  `acetrum.sourcePath` so a host that only kept the JSON can still re-nest it.
- `preserveGroups` for real Fabric `Group` objects, built from children that are
  already in absolute coordinates so grouping never moves artwork.
- `parseSvg` reads the layer tree from the DOM alone — no Fabric, no canvas, so
  it runs on a server.
- Deterministic ids derived from tree position, so re-importing the same file
  produces byte-identical JSON.
- Group bounds measured as the union of their children.
- `<defs>`, `<clipPath>`, `<mask>` and friends are not mistaken for layers.

### Sizing

- Absolute `width`/`height` win, `viewBox` fills in, and a file with neither gets
  a documented fallback and a `SIZE_ASSUMED` warning.
- Physical units (`mm`, `cm`, `in`, `pt`, `pc`, `Q`) converted at 96 dpi.
- Percentage widths fall through to the viewBox, since there is no container.
- `scale` applied at parse time by rewriting the root against a fixed viewBox,
  leaving path data exact.

### Security

- Sanitization on by default: `<script>`, `<foreignObject>`, `<iframe>`,
  `<embed>`, `<object>`, SMIL animation elements, every `on*` attribute,
  `javascript:`/`vbscript:` URLs, non-image `data:` URLs, and `@import` /
  `expression()` inside `<style>`.
- Other-origin references dropped unless `allowExternalResources` is set.
- Parsing goes through `image/svg+xml`, never the lenient HTML parser.
- Byte, pixel and element limits enforced before the expensive work.
- Everything removed is reported; `SCRIPT_REMOVED` means the file carried
  something that would have executed.

### Host integration

- `emitArtboard` for editors whose page comes from the document.
- `origin` / `applyOrigin` for editors whose artboard already exists elsewhere.
- `clipToDocument` for keeping off-artboard artwork out of view.
- `setObjectName` so layers panels have something to show.
- `registerAcetrumProperties` so the metadata survives the host's own saves.
- `addToFabric` to import into an existing design, `loadIntoFabric` to replace it.
- `hasExternalAssets` / `inlineImages` for JSON that has to survive being saved.
- Progress events with a monotonic ratio.

### Known limitations

- SVG filters, masks and `mix-blend-mode` are reported per use, not applied.
- Group opacity is an approximation — Fabric multiplies group alpha into each
  child rather than compositing the group first.
- Objects come back on a centre origin, as Fabric's SVG parser leaves them.
- Fonts are matched by name; an SVG references fonts rather than embedding them.
- No worker mode: Fabric's SVG parser needs a DOM.
