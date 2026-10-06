/**
 * Parser de HTML sem dependências externas.
 *
 * Fica em módulo próprio (e não dentro do handler do Worker) para poder ser
 * executado em Node durante os testes, sem precisar subir o wrangler.
 */

/**
 * Os tipos do payload vêm de `shared/report-types.ts`, a mesma fonte que o
 * front consome. Reexportados aqui para não quebrar quem importa de `./parse`.
 */
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

// Os padrões dependem só do nome do atributo ou da tag, um conjunto pequeno e
// fechado. Recompilar a mesma RegExp a cada tag do documento era o custo
// dominante do parsing; o cache elimina isso sem mudar resultado nenhum.
const attrRegexCache = new Map<string, RegExp>();

/** Lê o valor de um atributo dentro de uma tag isolada. */
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



/*
 * Varredura linear.
 *
 * O HTML vem do site auditado, ou seja, de quem quiser. Regex como
 * `<meta\b[^>]*>` ou `<script\b[^>]*>[\s\S]*?<\/script>` aplicadas com a flag
 * `g` recomeçam a busca a cada posição: num documento de `<meta` repetido sem
 * `>`, cada tentativa varre até o fim e o custo vira quadrático (100 KB já
 * custavam segundos de CPU). As funções abaixo procuram só o começo da tag
 * com regex (custo constante por posição) e o resto com `indexOf`. Quando um
 * `>` ou um fechamento não existe a partir de um ponto, também não existe a
 * partir de nenhum ponto posterior, então a varredura para ali em vez de
 * tentar de novo. O resultado é o mesmo das regex originais.
 */

/** Primeira ocorrência de `pattern` (regex com flag `g`) a partir de `from`. */
const searchFrom = (text: string, pattern: RegExp, from: number): RegExpExecArray | null => {
  pattern.lastIndex = from;
  return pattern.exec(text);
};

interface RawElement {
  /** Índice do `<` de abertura. */
  start: number;
  /** Índice logo depois do fechamento. */
  end: number;
  /** Tag de abertura completa, de `<` a `>`. */
  openTag: string;
  /** Conteúdo entre a abertura e o fechamento. */
  content: string;
}

/**
 * Equivale a `/<nome\b[^>]*>([\s\S]*?)<fechamento>/gi`, em ordem. `accept`
 * recusa uma abertura como a regex recusaria (atributo exigido ausente); as
 * aberturas que caem dentro dela compartilham o mesmo `>` e, por terem só um
 * pedaço do mesmo texto, também seriam recusadas, então são puladas juntas.
 */
function* rawElements(
  html: string,
  open: RegExp,
  close: RegExp,
  accept?: (openTag: string) => boolean,
): Generator<RawElement> {
  let from = 0;
  for (let match = searchFrom(html, open, from); match; match = searchFrom(html, open, from)) {
    const start = match.index;
    const gt = html.indexOf('>', start);
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

/** Troca cada elemento encontrado por um espaço, como `replace(regex, ' ')`. */
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

/** Equivale a `text.replace(/<[^>]+>/g, ' ')`. */
const replaceTags = (text: string): string => {
  const parts: string[] = [];
  let last = 0;
  let lt = text.indexOf('<');
  while (lt !== -1) {
    const gt = text.indexOf('>', lt + 1);
    if (gt === -1) break;
    // `<>` não casa com `[^>]+`: o `<` fica e a busca segue.
    if (gt === lt + 1) {
      lt = text.indexOf('<', lt + 1);
      continue;
    }
    parts.push(text.slice(last, lt), ' ');
    last = gt + 1;
    lt = text.indexOf('<', last);
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

/** Equivale a `html.match(/<(?:meta|img|script|link|html)\b[^>]*>/gi)`. */
const TAG_OPEN = /<(?:meta|img|script|link|html)\b/gi;
const collectTags = (html: string): string[] => {
  const tags: string[] = [];
  let from = 0;
  for (let match = searchFrom(html, TAG_OPEN, from); match; match = searchFrom(html, TAG_OPEN, from)) {
    const gt = html.indexOf('>', match.index);
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

/**
 * Acha, em uma varredura só, um elemento de texto cru (`<script>`/`<style>`
 * junto ao seu conteúdo completo) OU um comentário HTML, fechado ou não.
 *
 * A ordem das alternativas é o que faz o `<!--` que aparece dentro de um
 * JavaScript embutido (`var s = "<!--"`) não ser confundido com comentário: ao
 * chegar no `<script`, a primeira alternativa consome o bloco inteiro antes de
 * a segunda ter chance de olhar para dentro dele.
 */
const RAW_TEXT_OR_COMMENT_OPEN = /<(script|style)\b|<!--/gi;
const RAW_TEXT_CLOSE: Record<string, RegExp> = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
};

/**
 * Remove apenas comentários HTML, preservando o restante do documento.
 *
 * É de propósito que esta função não faça o que `stripNonContent` faz: os
 * blocos `<script>` e `<style>` precisam continuar no HTML, porque é deles que
 * saem as contagens de scripts (total, externos, bloqueantes), o JSON-LD e o
 * peso do CSS embutido. Usar `stripNonContent` antes da coleta de tags zeraria
 * essas métricas silenciosamente.
 *
 * O `<!--` sem fechamento consome o resto do documento, que é como o navegador
 * também se comporta: nada depois dele chega a virar elemento.
 */
const stripComments = (html: string): string => {
  const parts: string[] = [];
  let last = 0;
  let from = 0;
  // Depois que um `>` ou um fechamento não aparece a partir de um ponto, ele
  // também não aparece adiante: lembrar disso evita buscas repetidas até o fim.
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
      const gt = html.indexOf('>', start);
      if (gt === -1) {
        noGt = true;
        continue;
      }
      const closing = searchFrom(html, RAW_TEXT_CLOSE[rawName]!, gt + 1);
      if (!closing) {
        noClose[rawName] = true;
        continue;
      }
      // O bloco fica como está; a busca recomeça depois do fechamento.
      from = closing.index + closing[0].length;
      continue;
    }

    const commentEnd = html.indexOf('-->', start + 4);
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
  // Equivale a `replace(/<!--[\s\S]*?-->/g, ' ')`: comentário sem fechamento fica.
  const parts: string[] = [];
  let last = 0;
  for (let start = text.indexOf('<!--'); start !== -1; start = text.indexOf('<!--', last)) {
    const end = text.indexOf('-->', start + 4);
    if (end === -1) break;
    parts.push(text.slice(last, start), ' ');
    last = end + 3;
  }
  if (last === 0) return text;
  parts.push(text.slice(last));
  return parts.join('');
};

/**
 * Única leitura que continua usando o HTML cru, comentários inclusive.
 *
 * Vários CMS se identificam justamente dentro de comentários — o WordPress e
 * seus plugins deixam rastros como `<!-- This site is optimized with ... -->`
 * ou blocos de cache citando `/wp-content/`. Filtrar comentários aqui não
 * removeria falso positivo nenhum; só cegaria a detecção de plataforma.
 */
const detectPlatform = (html: string, generator: string | null): string | null => {
  if (generator) {
    const g = generator.toLowerCase();
    if (g.includes('wordpress')) return 'WordPress';
    if (g.includes('wix')) return 'Wix';
    if (g.includes('joomla')) return 'Joomla';
    if (g.includes('drupal')) return 'Drupal';
    if (g.includes('astro')) return 'Astro';
    if (g.includes('hugo')) return 'Hugo';
    if (g.includes('gatsby')) return 'Gatsby';
  }
  if (/\/wp-content\/|\/wp-includes\//i.test(html)) return 'WordPress';
  if (/static\.parastorage\.com|wix\.com/i.test(html)) return 'Wix';
  if (/cdn\.shopify\.com/i.test(html)) return 'Shopify';
  if (/squarespace\.com/i.test(html)) return 'Squarespace';
  if (/webflow\.com/i.test(html)) return 'Webflow';
  if (/_next\/static/i.test(html)) return 'Next.js';
  if (/\/_astro\//i.test(html)) return 'Astro';
  if (/lojaintegrada/i.test(html)) return 'Loja Integrada';
  if (/rdstation/i.test(html)) return 'RD Station';
  return null;
};

/**
 * Equivale a `/<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/i.exec(html)?.[1]`.
 * A regex é aplicada só no início de cada `<meta` (flag `y`). Se uma tag não
 * declara charset, as aberturas de `<meta` dentro dela, que terminam no mesmo
 * `>`, também não declaram, então a busca pula direto para depois dele.
 */
const CHARSET_AT_RE = /<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/iy;
const findCharset = (html: string): string | null => {
  let from = 0;
  for (let match = searchFrom(html, META_OPEN, from); match; match = searchFrom(html, META_OPEN, from)) {
    CHARSET_AT_RE.lastIndex = match.index;
    const charset = CHARSET_AT_RE.exec(html);
    if (charset) return charset[1] ?? null;
    const gt = html.indexOf('>', match.index);
    if (gt === -1) return null;
    from = gt + 1;
  }
  return null;
};

const JSON_LD_TYPE_RE = /type\s*=\s*["']application\/ld\+json["']/i;

const collectJsonLdTypes = (html: string): string[] => {
  const types = new Set<string>();
  const isJsonLd = (openTag: string): boolean => JSON_LD_TYPE_RE.test(openTag);

  for (const { content: body } of rawElements(html, SCRIPT_OPEN, SCRIPT_CLOSE, isJsonLd)) {
    try {
      const parsed: unknown = JSON.parse(body);
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          const type = record['@type'];
          if (typeof type === 'string') types.add(type);
          if (Array.isArray(type)) type.forEach((t) => typeof t === 'string' && types.add(t));
          if (Array.isArray(record['@graph'])) (record['@graph'] as unknown[]).forEach(walk);
        }
      };
      walk(parsed);
    } catch {
      // JSON-LD malformado é em si um achado, mas não interrompe a auditoria.
      const fallback = /"@type"\s*:\s*"([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = fallback.exec(body)) !== null) types.add(match[1]);
    }
  }
  return [...types];
};


const SRC_RE = /\bsrc\s*=/i;
const ASYNC_DEFER_RE = /\b(?:async|defer)\b/i;
const TYPE_MODULE_RE = /\btype\s*=\s*(?:"module"|'module'|module)(?!\w)/i;
const WORD_RE = /\S{2,}/g;

export const parseHtml = (html: string, bytes: number): HtmlReport => {
  // O que está dentro de comentário não é elemento da página: o navegador não
  // pinta, o crawler não indexa e a auditoria não deve contar. Todas as
  // leituras de estrutura passam a partir daqui pelo `markup` sem comentários,
  // e não pelo `html` cru — a única exceção é `detectPlatform`, pelos motivos
  // documentados nela.
  const markup = stripComments(html);

  const metaTags: string[] = [];
  const imageTags: string[] = [];
  const scriptTags: string[] = [];
  const linkTags: string[] = [];
  let htmlTag = '';

  for (const tag of collectTags(markup)) {
    const char = tag.charCodeAt(1) | 32;
    if (char === 109) metaTags.push(tag);
    else if (char === 105) imageTags.push(tag);
    else if (char === 115) scriptTags.push(tag);
    else if (char === 108) linkTags.push(tag);
    else if (char === 104 && !htmlTag) htmlTag = tag;
  }

  const title = clean(rawElements(markup, TITLE_OPEN, TITLE_CLOSE).next().value?.content ?? null);
  const metaDict = parseMetaTags(metaTags);
  const getMeta = (keyAttr: 'name' | 'property', key: string) => metaDict.get(`${keyAttr}:${key.toLowerCase()}`) ?? null;
  const metaDescription = getMeta('name', 'description');

  const h1 = [...rawElements(markup, H1_OPEN, H1_CLOSE)]
    .map((element) => clean(replaceTags(element.content)))
    .filter((value): value is string => value !== null);

  const images: ImageStats = {
    total: imageTags.length,
    withoutAlt: 0,
    withoutDimensions: 0,
    lazy: 0,
  };


  const ATTRS_FAST_RE = /\b(?:alt\s*=|width\s*=|height\s*=|loading\s*=\s*(?:"lazy"|'lazy'|lazy)(?!\w))/gi;

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

  const scripts: ScriptStats = {
    total: scriptTags.length,
    external: 0,
    blocking: 0,
  };
  for (const tag of scriptTags) {
    if (SRC_RE.test(tag)) {
      scripts.external++;
      if (!ASYNC_DEFER_RE.test(tag) && !TYPE_MODULE_RE.test(tag)) {
        scripts.blocking++;
      }
    }
  }

  const relOf = (tag: string): string => (attr(tag, 'rel') ?? '').toLowerCase();

  let canonical: string | null = null;
  let favicon = false;
  let stylesheets = 0;
  const hreflang: string[] = [];

  for (const tag of linkTags) {
    const rel = relOf(tag);
    if (rel === 'canonical' && canonical === null) {
      canonical = clean(attr(tag, 'href'));
    }
    if (rel.includes('icon')) favicon = true;
    if (rel.includes('stylesheet')) stylesheets++;
    if (rel === 'alternate') {
      const hlang = attr(tag, 'hreflang');
      if (hlang !== null) hreflang.push(hlang);
    }
  }

  let inlineStyleBytes = 0;
  for (const element of rawElements(markup, STYLE_OPEN, STYLE_CLOSE)) inlineStyleBytes += element.content.length;

  const generator = getMeta('name', 'generator');
  const textContent = replaceTags(stripNonContent(markup));
  const decodedText = decodeEntities(textContent);
  let wordCount = 0;
  while (WORD_RE.test(decodedText)) {
    wordCount++;
  }

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
    h1,
    h2Count: (markup.match(/<h2\b/gi) ?? []).length,
    images,
    openGraph: {
      title: getMeta('property', 'og:title'),
      description: getMeta('property', 'og:description'),
      image: getMeta('property', 'og:image'),
    },
    twitterCard: getMeta('name', 'twitter:card'),
    jsonLdTypes: collectJsonLdTypes(markup),
    favicon,
    scripts,
    stylesheets,
    inlineStyleBytes,
    generator,
    hreflang,
    wordCount,
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
