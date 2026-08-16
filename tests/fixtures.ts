/** Markup shaped the way each exporter actually writes it. */

/** Figma: layer name in `data-name`, `id` mangled into something generated. */
export const FIGMA = `<svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g id="Frame_1" data-name="Card">
    <rect id="Rectangle_2" data-name="Background" width="200" height="100" fill="#EEEEEE"/>
    <g id="Group_3" data-name="Badge">
      <circle id="Ellipse_4" data-name="Dot" cx="30" cy="30" r="10" fill="#FF0000"/>
      <path id="Vector_5" data-name="Tick" d="M25 30 L29 34 L36 26" stroke="#FFFFFF"/>
    </g>
  </g>
</svg>`;

/** Illustrator: layer name straight in `id`, no `data-name` anywhere. */
export const ILLUSTRATOR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <g id="Background">
    <rect x="0" y="0" width="120" height="120" fill="#123456"/>
  </g>
  <g id="Logo">
    <path id="Left_Wing" d="M10 10 L50 10 L30 50 Z" fill="#ffffff"/>
    <path id="Right_Wing" d="M70 10 L110 10 L90 50 Z" fill="#ffffff"/>
  </g>
</svg>`;

/** Inkscape: real name in `inkscape:label`, generated `id`. */
export const INKSCAPE = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="80" height="80" viewBox="0 0 80 80">
  <g id="layer1" inkscape:label="Outlines" inkscape:groupmode="layer">
    <rect id="rect938" width="40" height="40" x="5" y="5" fill="#00ff00"/>
  </g>
</svg>`;

/** Every way an SVG can carry something that runs. */
export const MALICIOUS = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100" viewBox="0 0 100 100" onload="alert(1)">
  <script>alert('xss')</script>
  <style>@import url('https://evil.example/x.css'); .a { fill: red }</style>
  <rect width="50" height="50" fill="#000000" onclick="alert(2)"/>
  <a href="javascript:alert(3)"><circle cx="70" cy="70" r="10" fill="#00f"/></a>
  <image xlink:href="https://evil.example/tracker.png" x="0" y="0" width="10" height="10"/>
  <foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject>
  <rect x="60" y="0" width="20" height="20" fill="#0f0">
    <animate attributeName="href" values="javascript:alert(4)"/>
  </rect>
</svg>`;

/** No width/height, viewBox only — the most common real-world shape. */
export const VIEWBOX_ONLY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 2 L22 22 L2 22 Z" fill="#333"/>
</svg>`;

/** Physical units, which have to be converted to pixels. */
export const MILLIMETRES = `<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10">
  <rect width="10" height="10" fill="#abcdef"/>
</svg>`;

/** Neither a size nor a viewBox. */
export const NO_SIZE = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>`;

/** Hidden layers, every way of hiding them — including a hidden group. */
export const HIDDEN = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
  <rect id="Shown" width="10" height="10" fill="#000"/>
  <rect id="Invisible" width="10" height="10" x="20" fill="#000" visibility="hidden"/>
  <rect id="Undisplayed" width="10" height="10" x="35" fill="#000" display="none"/>
  <g id="HiddenGroup" style="display:none">
    <rect id="Inside" width="5" height="5" y="20" fill="#000"/>
  </g>
</svg>`;

/** A group with its own opacity, plus defs that must not become layers. */
export const OPACITY_AND_DEFS = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
  </defs>
  <g id="Faded" opacity="0.5">
    <rect width="100" height="100" fill="url(#grad)"/>
  </g>
</svg>`;
