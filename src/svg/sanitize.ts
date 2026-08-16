/**
 * Strip everything active out of an SVG before it reaches a parser.
 *
 * This is the one concern an SVG importer has that a PSD or AI importer does
 * not. Those are binary formats: you read numbers out of them and the bytes
 * never become markup. An SVG *is* markup, and any path that puts it in front
 * of a DOM — `DOMParser`, `innerHTML`, an `<img src="blob:…">`, Fabric's own
 * parser — is a path that can run what the file brought with it. A user
 * uploading a logo to an editor is exactly the untrusted-input case.
 *
 * The approach is a deny-list of the constructs that can execute, not an
 * allow-list of the ones that draw: SVG has too many drawing elements to
 * enumerate safely, and a missed one is a missing logo rather than a hole.
 */

const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Elements removed outright, with their subtrees. */
const FORBIDDEN_TAGS = new Set([
  // Runs script, obviously.
  'script',
  // A hole straight out of SVG and into HTML, where anything goes.
  'foreignobject',
  // Embeds arbitrary external documents.
  'iframe',
  'embed',
  'object',
  // SMIL. Fabric cannot animate anyway, and `<animate attributeName="href">`
  // is a well-known way to smuggle a `javascript:` URL past a naive filter that
  // only checked the static attributes.
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  // Declarative event wiring.
  'handler',
  'listener',
]);

/** Attributes carrying a URL, in the order they should be checked. */
const URL_ATTRS = ['href', 'src', 'xlink:href', 'from', 'to', 'values', 'by'];

/** URL schemes that can execute or smuggle markup. */
const DANGEROUS_SCHEME = /^\s*(?:javascript|vbscript|livescript|mocha)\s*:/i;
/** A `data:` URL that is not an image is a document, and a document can script. */
const NON_IMAGE_DATA = /^\s*data:(?!image\/(?:png|jpe?g|gif|webp|avif|bmp)\b)/i;

export interface SanitizeOptions {
  /** Allow `<image>`/`<use>` to point at another origin over http(s). */
  allowExternalResources: boolean;
}

export interface SanitizeReport {
  /** One entry per distinct thing removed, ready to become a warning. */
  removed: string[];
  /** URLs pointing at another origin that were dropped. */
  externalRefs: string[];
  /** True when something executable was found — always worth telling the host. */
  foundActiveContent: boolean;
}

function isExternal(url: string): boolean {
  return /^\s*(?:https?:)?\/\//i.test(url);
}

/**
 * `on*` covers every DOM event handler attribute there is, and SVG defines no
 * drawing attribute that starts with `on`, so the prefix test is both complete
 * and safe. Checking a list of known handler names is not — the list grows.
 */
function isEventHandler(name: string): boolean {
  return name.length > 2 && name.slice(0, 2).toLowerCase() === 'on';
}

function cleanStyleText(text: string): { text: string; changed: boolean } {
  // `@import` fetches a remote stylesheet; `expression()` is legacy IE script;
  // `url(javascript:…)` is the same hole as a `href`.
  const cleaned = text
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'void(')
    .replace(/url\s*\(\s*['"]?\s*(?:javascript|vbscript)\s*:[^)]*\)/gi, 'none');
  return { text: cleaned, changed: cleaned !== text };
}

/**
 * Sanitize a parsed SVG document in place.
 *
 * Mutating rather than cloning is deliberate: the caller parsed the document
 * for this, and a copy would double peak memory on a large file for no gain.
 */
export function sanitizeSvgDocument(
  root: Element,
  options: SanitizeOptions,
): SanitizeReport {
  const removed = new Set<string>();
  const externalRefs: string[] = [];
  let foundActiveContent = false;

  // Collected first, then removed: mutating while walking a live tree skips
  // siblings, which is how a sanitizer ends up leaving one `<script>` behind.
  const doomed: Element[] = [];

  const visit = (element: Element): void => {
    const tag = element.localName.toLowerCase();

    if (FORBIDDEN_TAGS.has(tag)) {
      doomed.push(element);
      removed.add(`<${tag}>`);
      if (tag !== 'animate' && tag !== 'animatemotion' && tag !== 'animatetransform' && tag !== 'set') {
        foundActiveContent = true;
      }
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name;

      if (isEventHandler(name)) {
        element.removeAttribute(name);
        removed.add(`${name}=`);
        foundActiveContent = true;
        continue;
      }

      if (!URL_ATTRS.includes(name.toLowerCase())) continue;

      const value = attribute.value;

      if (DANGEROUS_SCHEME.test(value) || NON_IMAGE_DATA.test(value)) {
        removeUrlAttribute(element, name);
        removed.add(`${name}="${value.slice(0, 24)}…"`);
        foundActiveContent = true;
        continue;
      }

      if (!options.allowExternalResources && isExternal(value)) {
        removeUrlAttribute(element, name);
        externalRefs.push(value);
      }
    }

    if (tag === 'style' && element.textContent) {
      const { text, changed } = cleanStyleText(element.textContent);
      if (changed) {
        element.textContent = text;
        removed.add('<style> directive');
        foundActiveContent = true;
      }
    }

    for (const child of Array.from(element.children)) visit(child);
  };

  visit(root);

  for (const element of doomed) element.parentNode?.removeChild(element);

  return { removed: [...removed], externalRefs, foundActiveContent };
}

/**
 * `xlink:href` has to go through the namespace API — `removeAttribute` matches
 * on qualified name and quietly does nothing for a namespaced attribute in
 * some implementations, which would leave the URL in place.
 */
function removeUrlAttribute(element: Element, name: string): void {
  element.removeAttribute(name);
  if (name.toLowerCase().endsWith('href')) {
    element.removeAttributeNS(XLINK_NS, 'href');
  }
}
