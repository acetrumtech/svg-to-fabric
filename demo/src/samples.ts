/**
 * Sample files, inline rather than on disk so the demo works from a bare
 * checkout and so each one can say what it is there to prove.
 */
export interface Sample {
  label: string;
  note: string;
  svg: string;
}

export const SAMPLES: Sample[] = [
  {
    label: 'Figma export',
    note: 'Nested groups, names in data-name, ids mangled',
    svg: `<svg width="320" height="200" viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g id="Frame_1" data-name="Card">
    <rect id="Rectangle_2" data-name="Background" width="320" height="200" rx="16" fill="#1D4ED8"/>
    <g id="Group_3" data-name="Badge">
      <circle id="Ellipse_4" data-name="Dot" cx="48" cy="48" r="20" fill="#FBBF24"/>
      <path id="Vector_5" data-name="Tick" d="M38 48 L45 55 L59 41" stroke="#1D4ED8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g id="Group_6" data-name="Bars">
      <rect id="Rectangle_7" data-name="Bar 1" x="32" y="100" width="180" height="14" rx="7" fill="#93C5FD"/>
      <rect id="Rectangle_8" data-name="Bar 2" x="32" y="128" width="120" height="14" rx="7" fill="#60A5FA"/>
      <rect id="Rectangle_9" data-name="Bar 3" x="32" y="156" width="220" height="14" rx="7" fill="#3B82F6"/>
    </g>
  </g>
</svg>`,
  },
  {
    label: 'Illustrator export',
    note: 'Layer names in id, gradient in defs',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0EA5E9"/>
      <stop offset="1" stop-color="#7DD3FC"/>
    </linearGradient>
  </defs>
  <g id="Sky">
    <rect x="0" y="0" width="240" height="240" fill="url(#sky)"/>
  </g>
  <g id="Mountains">
    <path id="Far_Peak" d="M0 200 L80 90 L160 200 Z" fill="#334155"/>
    <path id="Near_Peak" d="M90 200 L170 60 L240 200 Z" fill="#0F172A"/>
  </g>
  <g id="Sun">
    <circle id="Disc" cx="185" cy="55" r="26" fill="#FDE68A"/>
  </g>
</svg>`,
  },
  {
    label: 'Inkscape export',
    note: 'Names in inkscape:label, generated ids',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="200" height="200" viewBox="0 0 200 200">
  <g id="layer1" inkscape:label="Frame" inkscape:groupmode="layer">
    <rect id="rect938" x="10" y="10" width="180" height="180" fill="none" stroke="#111827" stroke-width="6"/>
  </g>
  <g id="layer2" inkscape:label="Contents" inkscape:groupmode="layer">
    <circle id="path1042" cx="100" cy="100" r="50" fill="#EF4444"/>
    <rect id="rect1044" x="80" y="80" width="40" height="40" fill="#FEF3C7"/>
  </g>
</svg>`,
  },
  {
    label: 'Hostile file',
    note: 'Scripts, handlers, javascript: URLs, a tracker — all stripped',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200" viewBox="0 0 200 200" onload="alert('onload')">
  <script>alert('inline script')</script>
  <style>@import url('https://evil.example/x.css'); .safe { opacity: 1 }</style>
  <rect id="Clickjack" width="200" height="200" fill="#F3F4F6" onclick="alert('onclick')"/>
  <a href="javascript:alert('link')"><circle id="Trap" cx="100" cy="100" r="60" fill="#DC2626"/></a>
  <image id="Tracker" xlink:href="https://evil.example/pixel.png" x="0" y="0" width="1" height="1"/>
  <foreignObject width="50" height="50"><body xmlns="http://www.w3.org/1999/xhtml">html</body></foreignObject>
  <rect id="Animated" x="70" y="70" width="60" height="60" fill="#FCA5A5">
    <animate attributeName="href" values="javascript:alert('smuggled')"/>
  </rect>
</svg>`,
  },
  {
    label: 'Icon, no size',
    note: 'viewBox only — try the scale option on it',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path id="Body" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <path id="Door" d="M9 22V12h6v10"/>
</svg>`,
  },
];
