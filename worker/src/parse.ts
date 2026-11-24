
import type { HtmlReport, ImageStats, ScriptStats, RobotsReport } from '../../shared/report-types.ts';

export type { HtmlReport, RobotsReport } from '../../shared/report-types.ts';

const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
  '&#x27;': "'",
  '&#X27;': "'",
};
const ENTITIES_REGEX = /&(?:nbsp|amp|lt|gt|quot|#0?39|#[xX]27);/g;

const decodeEntities = (value: string): string => {
  if (!value.includes('&')) return value;
  return value.replace(ENTITIES_REGEX, (match) => ENTITY_MAP[match]);
};

const clean = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
};

const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const attrRegexCache = new Map<string, RegExp>();

const attr = (tag: string, name: string): string | null => {
  let regex = attrRegexCache.get(name);
  if (!regex) {
    regex = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s">]+))`, 'i');
    attrRegexCache.set(name, regex);
  }
  const match = regex.exec(tag);
  if (match) {
    return match[1] ?? match[2] ?? match[3] ?? null;
  }
  return null;
};

export interface ParseWork {
  scans: number;
  chars: number;
}

let activeWork: ParseWork | null = null;

const recordWork = (chars: number): void => {
  if (!activeWork) return;
  activeWork.scans++;
  activeWork.chars += chars;
};

export const measureParseWork = <T>(run: () => T): { result: T; work: ParseWork } => {
  const work: ParseWork = { scans: 0, chars: 0 };
  const previous = activeWork;
  activeWork = work;
  try {
    return { result: run(), work };
  } finally {
    activeWork = previous;
  }
};

const searchFrom = (text: string, pattern: RegExp, from: number): RegExpExecArray | null => {
  pattern.lastIndex = from;
  const match = pattern.exec(text);
  if (activeWork) recordWork((match ? match.index + match[0].length : text.length) - from);
  return match;
};

const findFrom = (text: string, needle: string, from: number): number => {
  const index = text.indexOf(needle, from);
  if (activeWork) recordWork((index === -1 ? text.length : index + needle.length) - from);
  return index;
};

interface RawElement {
  start: number;
  end: number;
  openTag: string;
  content: string;
}

function* rawElements(
  html: string,
  open: RegExp,
  close: RegExp,
  accept?: (openTag: string) => boolean,
): Generator<RawElement> {
  let from = 0;
  for (let match = searchFrom(html, open, from); match; match = searchFrom(html, open, from)) {
    const start = match.index;
    const gt = findFrom(html, '>', start);
    if (gt === -1) return;
    const openTag = html.slice(start, gt + 1);
    if (accept && !accept(openTag)) {
      from = gt + 1;
      continue;
    }
    const closing = searchFrom(html, close, gt + 1);
    if (!closing) return;
    const end = closing.index + closing[0].length;
    yield { start, end, openTag, content: html.slice(gt + 1, closing.index) };
    from = end;
  }
}

const removeElements = (html: string, open: RegExp, close: RegExp): string => {
  const parts: string[] = [];
  let last = 0;
  for (const element of rawElements(html, open, close)) {
    parts.push(html.slice(last, element.start), ' ');
    last = element.end;
  }
  if (last === 0) return html;
  parts.push(html.slice(last));
  return parts.join('');
};

const replaceTags = (text: string): string => {
  const parts: string[] = [];
  let last = 0;
  let lt = findFrom(text, '<', 0);
  while (lt !== -1) {
    const gt = findFrom(text, '>', lt + 1);
    if (gt === -1) break;
    if (gt === lt + 1) {
      lt = findFrom(text, '<', lt + 1);
      continue;
    }
    parts.push(text.slice(last, lt), ' ');
    last = gt + 1;
    lt = findFrom(text, '<', last);
  }
  if (last === 0) return text;
  parts.push(text.slice(last));
  return parts.join('');
};

const SCRIPT_OPEN = /<script\b/gi;
const STYLE_OPEN = /<style\b/gi;
const NOSCRIPT_OPEN = /<noscript\b/gi;
const TITLE_OPEN = /<title\b/gi;
const H1_OPEN = /<h1\b/gi;
const META_OPEN = /<meta\b/gi;
const SCRIPT_CLOSE = /<\/script>/gi;
const STYLE_CLOSE = /<\/style>/gi;
const NOSCRIPT_CLOSE = /<\/noscript>/gi;
const TITLE_CLOSE = /<\/title>/gi;
const H1_CLOSE = /<\/h1>/gi;

const TAG_OPEN = /<(?:meta|img|script|link|html)\b/gi;
const collectTags = (html: string): string[] => {
  const tags: string[] = [];
  let from = 0;
  for (let match = searchFrom(html, TAG_OPEN, from); match; match = searchFrom(html, TAG_OPEN, from)) {
    const gt = findFrom(html, '>', match.index);
    if (gt === -1) break;
    tags.push(html.slice(match.index, gt + 1));
    from = gt + 1;
  }
  return tags;
};

const parseMetaTags = (tags: string[]): Map<string, string> => {
  const dict = new Map<string, string>();
  for (const tag of tags) {
    const contentAttr = attr(tag, 'content');
    if (contentAttr === null) continue;

    const content = clean(contentAttr);
    if (content === null) continue;

    const name = attr(tag, 'name');
    if (name) {
      const key = `name:${name.toLowerCase()}`;
      if (!dict.has(key)) dict.set(key, content);
    }

    const property = attr(tag, 'property');
    if (property) {
      const key = `property:${property.toLowerCase()}`;
      if (!dict.has(key)) dict.set(key, content);
    }
  }
  return dict;
};

const RAW_TEXT_OR_COMMENT_OPEN = /<(script|style)\b|<!--/gi;
const RAW_TEXT_CLOSE: Record<string, RegExp> = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
};

const stripComments = (html: string): string => {
  const parts: string[] = [];
  let last = 0;
  let from = 0;
  let noGt = false;
  const noClose: Record<string, boolean> = {};

  for (
    let match = searchFrom(html, RAW_TEXT_OR_COMMENT_OPEN, from);
    match;
    match = searchFrom(html, RAW_TEXT_OR_COMMENT_OPEN, from)
  ) {
    const start = match.index;
    const rawName = match[1]?.toLowerCase();

    if (rawName) {
      from = start + 1;
      if (noGt || noClose[rawName]) continue;
      const gt = findFrom(html, '>', start);
      if (gt === -1) {
        noGt = true;
        continue;
      }
      const closing = searchFrom(html, RAW_TEXT_CLOSE[rawName]!, gt + 1);
      if (!closing) {
        noClose[rawName] = true;
        continue;
      }
      from = closing.index + closing[0].length;
      continue;
    }

    const commentEnd = findFrom(html, '-->', start + 4);
    parts.push(html.slice(last, start), ' ');
    if (commentEnd === -1) {
      last = html.length;
      break;
    }
    last = commentEnd + 3;
    from = last;
  }

  if (last === 0) return html;
  parts.push(html.slice(last));
  return parts.join('');
};

const stripNonContent = (html: string): string => {
  let text = removeElements(html, SCRIPT_OPEN, SCRIPT_CLOSE);
  text = removeElements(text, STYLE_OPEN, STYLE_CLOSE);
  text = removeElements(text, NOSCRIPT_OPEN, NOSCRIPT_CLOSE);
  const parts: string[] = [];
  let last = 0;
  for (let start = findFrom(text, '<!--', 0); start !== -1; start = findFrom(text, '<!--', last)) {
    const end = findFrom(text, '-->', start + 4);
    if (end === -1) break;
    parts.push(text.slice(last, start), ' ');
    last = end + 3;
  }
  if (last === 0) return text;
  parts.push(text.slice(last));
  return parts.join('');
};

const GENERATOR_PLATFORMS: readonly (readonly [string, string])[] = [
  ['wordpress', 'WordPress'],
  ['wix', 'Wix'],
  ['joomla', 'Joomla'],
  ['drupal', 'Drupal'],
  ['astro', 'Astro'],
  ['hugo', 'Hugo'],
  ['gatsby', 'Gatsby'],
];

const CONTENT_PLATFORMS: readonly (readonly [RegExp, string])[] = [
  [/\/wp-content\/|\/wp-includes\//i, 'WordPress'],
  [/static\.parastorage\.com|wix\.com/i, 'Wix'],
  [/cdn\.shopify\.com/i, 'Shopify'],
  [/squarespace\.com/i, 'Squarespace'],
  [/webflow\.com/i, 'Webflow'],
  [/_next\/static/i, 'Next.js'],
  [/\/_astro\//i, 'Astro'],
  [/lojaintegrada/i, 'Loja Integrada'],
  [/rdstation/i, 'RD Station'],
];

const platformFromGenerator = (generator: string | null): string | null => {
  if (!generator) return null;
  const lower = generator.toLowerCase();
  return GENERATOR_PLATFORMS.find(([needle]) => lower.includes(needle))?.[1] ?? null;
};

const platformFromContent = (html: string): string | null =>
  CONTENT_PLATFORMS.find(([pattern]) => pattern.test(html))?.[1] ?? null;

const detectPlatform = (html: string, generator: string | null): string | null =>
  platformFromGenerator(generator) ?? platformFromContent(html);

const CHARSET_AT_RE = /<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/iy;
const findCharset = (html: string): string | null => {
  let from = 0;
  for (let match = searchFrom(html, META_OPEN, from); match; match = searchFrom(html, META_OPEN, from)) {
    CHARSET_AT_RE.lastIndex = match.index;
    const charset = CHARSET_AT_RE.exec(html);
    if (charset) return charset[1] ?? null;
    const gt = findFrom(html, '>', match.index);
    if (gt === -1) return null;
    from = gt + 1;
  }
  return null;
};

const JSON_LD_TYPE_RE = /type\s*=\s*["']application\/ld\+json["']/i;

const MAX_JSON_LD_DEPTH = 32;

const MAX_JSON_NESTING = 256;

const OPEN_BRACKETS = new Set([0x5b, 0x7b]);
const CLOSE_BRACKETS = new Set([0x5d, 0x7d]);

const exceedsNesting = (text: string, max: number): boolean => {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (inString) {
      if (code === 0x5c) i++;
      else if (code === 0x22) inString = false;
    } else if (code === 0x22) {
      inString = true;
    } else if (OPEN_BRACKETS.has(code)) {
      if (++depth > max) {
        recordWork(i + 1);
        return true;
      }
    } else if (CLOSE_BRACKETS.has(code)) {
      depth--;
    }
  }
  recordWork(text.length);
  return false;
};

const typesOf = (record: Record<string, unknown>): string[] => {
  const type = record['@type'];
  if (typeof type === 'string') return [type];
  return Array.isArray(type) ? type.filter((t): t is string => typeof t === 'string') : [];
};

const jsonLdChildren = (node: unknown): unknown[] => {
  if (Array.isArray(node)) return node;
  if (!node || typeof node !== 'object') return [];
  const graph = (node as Record<string, unknown>)['@graph'];
  return Array.isArray(graph) ? graph : [];
};

const walkJsonLd = (root: unknown, types: Set<string>): void => {
  const stack: { node: unknown; depth: number }[] = [{ node: root, depth: 0 }];
  for (let item = stack.pop(); item; item = stack.pop()) {
    const { node, depth } = item;
    if (!Array.isArray(node) && node && typeof node === 'object') {
      for (const type of typesOf(node as Record<string, unknown>)) types.add(type);
    }
    if (depth >= MAX_JSON_LD_DEPTH) continue;
    const children = jsonLdChildren(node);
    for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], depth: depth + 1 });
  }
};

const FALLBACK_TYPE_RE = /"@type"\s*:\s*"([^"]+)"/g;

const collectJsonLdTypes = (html: string): string[] => {
  const types = new Set<string>();
  const isJsonLd = (openTag: string): boolean => JSON_LD_TYPE_RE.test(openTag);

  for (const { content: body } of rawElements(html, SCRIPT_OPEN, SCRIPT_CLOSE, isJsonLd)) {
    if (exceedsNesting(body, MAX_JSON_NESTING)) continue;
    try {
      walkJsonLd(JSON.parse(body), types);
    } catch {
      for (const match of body.matchAll(FALLBACK_TYPE_RE)) types.add(match[1]);
    }
  }
  return [...types];
};

const SRC_RE = /\bsrc\s*=/i;
const ASYNC_DEFER_RE = /\b(?:async|defer)\b/i;
const TYPE_MODULE_RE = /\btype\s*=\s*(?:"module"|'module'|module)(?!\w)/i;
const WORD_RE = /\S{2,}/g;

interface TagGroups {
  metaTags: string[];
  imageTags: string[];
  scriptTags: string[];
  linkTags: string[];
  htmlTag: string;
}

const groupTags = (markup: string): TagGroups => {
  const groups: TagGroups = { metaTags: [], imageTags: [], scriptTags: [], linkTags: [], htmlTag: '' };
  for (const tag of collectTags(markup)) {
    const char = tag.charCodeAt(1) | 32;
    if (char === 109) groups.metaTags.push(tag);
    else if (char === 105) groups.imageTags.push(tag);
    else if (char === 115) groups.scriptTags.push(tag);
    else if (char === 108) groups.linkTags.push(tag);
    else if (char === 104 && !groups.htmlTag) groups.htmlTag = tag;
  }
  return groups;
};

const ATTRS_FAST_RE = /\b(?:alt\s*=|width\s*=|height\s*=|loading\s*=\s*(?:"lazy"|'lazy'|lazy)(?!\w))/gi;

const countImages = (imageTags: string[]): ImageStats => {
  const images: ImageStats = { total: imageTags.length, withoutAlt: 0, withoutDimensions: 0, lazy: 0 };

  for (const tag of imageTags) {
    let hasAlt = false, hasWidth = false, hasHeight = false, hasLazy = false;

    ATTRS_FAST_RE.lastIndex = 0;
    let m;
    while ((m = ATTRS_FAST_RE.exec(tag)) !== null) {
      const c = m[0].charCodeAt(0) | 32;
      if (c === 97) hasAlt = true;
      else if (c === 119) hasWidth = true;
      else if (c === 104) hasHeight = true;
      else if (c === 108) hasLazy = true;
    }

    if (!hasAlt) images.withoutAlt++;
    if (!hasWidth || !hasHeight) images.withoutDimensions++;
    if (hasLazy) images.lazy++;
  }
  return images;
};

const countScripts = (scriptTags: string[]): ScriptStats => {
  const scripts: ScriptStats = { total: scriptTags.length, external: 0, blocking: 0 };
  for (const tag of scriptTags) {
    if (!SRC_RE.test(tag)) continue;
    scripts.external++;
    if (!ASYNC_DEFER_RE.test(tag) && !TYPE_MODULE_RE.test(tag)) scripts.blocking++;
  }
  return scripts;
};

interface LinkInfo {
  canonical: string | null;
  favicon: boolean;
  stylesheets: number;
  hreflang: string[];
}

const readLinks = (linkTags: string[]): LinkInfo => {
  const info: LinkInfo = { canonical: null, favicon: false, stylesheets: 0, hreflang: [] };

  for (const tag of linkTags) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (rel === 'canonical' && info.canonical === null) info.canonical = clean(attr(tag, 'href'));
    if (rel.includes('icon')) info.favicon = true;
    if (rel.includes('stylesheet')) info.stylesheets++;
    if (rel === 'alternate') {
      const hlang = attr(tag, 'hreflang');
      if (hlang !== null) info.hreflang.push(hlang);
    }
  }
  return info;
};

const readH1 = (markup: string): string[] =>
  [...rawElements(markup, H1_OPEN, H1_CLOSE)]
    .map((element) => clean(replaceTags(element.content)))
    .filter((value): value is string => value !== null);

const sumInlineStyleBytes = (markup: string): number => {
  let bytes = 0;
  for (const element of rawElements(markup, STYLE_OPEN, STYLE_CLOSE)) bytes += element.content.length;
  return bytes;
};

const countWords = (markup: string): number => {
  const text = decodeEntities(replaceTags(stripNonContent(markup)));
  let words = 0;
  while (WORD_RE.test(text)) words++;
  return words;
};

export const parseHtml = (html: string, bytes: number): HtmlReport => {
  const markup = stripComments(html);
  const { metaTags, imageTags, scriptTags, linkTags, htmlTag } = groupTags(markup);

  const title = clean(rawElements(markup, TITLE_OPEN, TITLE_CLOSE).next().value?.content ?? null);
  const metaDict = parseMetaTags(metaTags);
  const getMeta = (keyAttr: 'name' | 'property', key: string) => metaDict.get(`${keyAttr}:${key.toLowerCase()}`) ?? null;
  const metaDescription = getMeta('name', 'description');
  const generator = getMeta('name', 'generator');
  const { canonical, favicon, stylesheets, hreflang } = readLinks(linkTags);

  return {
    bytes,
    lang: clean(attr(htmlTag, 'lang')),
    charset: clean(findCharset(markup)),
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical,
    robotsMeta: getMeta('name', 'robots'),
    viewport: getMeta('name', 'viewport'),
    h1: readH1(markup),
    h2Count: (markup.match(/<h2\b/gi) ?? []).length,
    images: countImages(imageTags),
    openGraph: {
      title: getMeta('property', 'og:title'),
      description: getMeta('property', 'og:description'),
      image: getMeta('property', 'og:image'),
    },
    twitterCard: getMeta('name', 'twitter:card'),
    jsonLdTypes: collectJsonLdTypes(markup),
    favicon,
    scripts: countScripts(scriptTags),
    stylesheets,
    inlineStyleBytes: sumInlineStyleBytes(markup),
    generator,
    hreflang,
    wordCount: countWords(markup),
    platform: detectPlatform(html, generator),
  };
};

export const parseRobots = (body: string): RobotsReport => {
  let inWildcardBlock = false;
  let blocksAll = false;
  const sitemaps: string[] = [];

  let start = 0;
  const len = body.length;
  while (start < len) {
    let end = body.indexOf('\n', start);
    if (end === -1) end = len;

    let lineStart = start;
    let lineEnd = end;

    if (lineEnd > lineStart && body.charCodeAt(lineEnd - 1) === 13) {
      lineEnd--;
    }

    while (lineStart < lineEnd && body.charCodeAt(lineStart) <= 32) {
      lineStart++;
    }

    while (lineEnd > lineStart && body.charCodeAt(lineEnd - 1) <= 32) {
      lineEnd--;
    }

    if (lineStart < lineEnd) {
      const line = body.slice(lineStart, lineEnd);
      const firstChar = line.charCodeAt(0) | 32;

      if (firstChar === 115 && /^sitemap\s*:/i.test(line)) {
        const colonIdx = line.indexOf(':');
        const sitemap = line.slice(colonIdx + 1).trim();
        if (sitemap) sitemaps.push(sitemap);
      } else if (firstChar === 117 && /^user-agent\s*:/i.test(line)) {
        const colonIdx = line.indexOf(':');
        inWildcardBlock = line.slice(colonIdx + 1).trim() === '*';
      } else if (inWildcardBlock && firstChar === 100 && /^disallow\s*:\s*\/\s*$/i.test(line)) {
        blocksAll = true;
      }
    }
    start = end + 1;
  }

  return { found: true, blocksAll, sitemaps };
};

export const countSitemapUrls = (xml: string): number => {
  const urls = (xml.match(/<loc>/gi) ?? []).length;
  return urls;
};

export const isSitemapIndex = (xml: string): boolean => /<sitemapindex/i.test(xml);
