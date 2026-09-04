/**
 * Parser de HTML sem dependências externas.
 *
 * Fica em módulo próprio (e não dentro do handler do Worker) para poder ser
 * executado em Node durante os testes, sem precisar subir o wrangler.
 */

export interface ImageStats {
  total: number;
  withoutAlt: number;
  withoutDimensions: number;
  lazy: number;
}

export interface ScriptStats {
  total: number;
  blocking: number;
  external: number;
}

export interface HtmlReport {
  bytes: number;
  lang: string | null;
  charset: string | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  h1: string[];
  h2Count: number;
  images: ImageStats;
  openGraph: { title: string | null; description: string | null; image: string | null };
  twitterCard: string | null;
  jsonLdTypes: string[];
  favicon: boolean;
  scripts: ScriptStats;
  stylesheets: number;
  inlineStyleBytes: number;
  generator: string | null;
  hreflang: string[];
  wordCount: number;
  platform: string | null;
}

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");

const clean = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
};

// Os padrões dependem só do nome do atributo ou da tag, um conjunto pequeno e
// fechado. Recompilar a mesma RegExp a cada tag do documento era o custo
// dominante do parsing; o cache elimina isso sem mudar resultado nenhum.
const attrRegexCache = new Map<string, { double: RegExp; single: RegExp; bare: RegExp }>();

/** Lê o valor de um atributo dentro de uma tag isolada. */
const attr = (tag: string, name: string): string | null => {
  let regexes = attrRegexCache.get(name);
  if (!regexes) {
    regexes = {
      double: new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'),
      single: new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'),
      bare: new RegExp(`\\b${name}\\s*=\\s*([^\\s">]+)`, 'i'),
    };
    attrRegexCache.set(name, regexes);
  }
  const doubleQuoted = regexes.double.exec(tag);
  if (doubleQuoted) return doubleQuoted[1];
  const singleQuoted = regexes.single.exec(tag);
  if (singleQuoted) return singleQuoted[1];
  const bare = regexes.bare.exec(tag);
  return bare ? bare[1] : null;
};

const hasAttrRegexCache = new Map<string, RegExp>();

const hasAttr = (tag: string, name: string): boolean => {
  let regex = hasAttrRegexCache.get(name);
  if (!regex) {
    regex = new RegExp(`\\b${name}\\b`, 'i');
    hasAttrRegexCache.set(name, regex);
  }
  return regex.test(tag);
};

// A flag 'g' aqui é segura de cachear: String.prototype.match com regex global
// zera lastIndex antes de varrer, então o estado não vaza entre chamadas.
const collectTagsRegexCache = new Map<string, RegExp>();

/** Todas as tags de um tipo, com o conteúdo interno quando houver. */
const collectTags = (html: string, tagName: string): string[] => {
  let regex = collectTagsRegexCache.get(tagName);
  if (!regex) {
    regex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
    collectTagsRegexCache.set(tagName, regex);
  }
  return html.match(regex) ?? [];
};

const metaContent = (tags: string[], keyAttr: 'name' | 'property', key: string): string | null => {
  for (const tag of tags) {
    const found = attr(tag, keyAttr);
    if (found && found.toLowerCase() === key.toLowerCase()) {
      return clean(attr(tag, 'content'));
    }
  }
  return null;
};

/**
 * Casa, em uma varredura só, um elemento de texto cru (`<script>`/`<style>`
 * com todo o seu conteúdo) OU um comentário HTML — fechado ou não.
 *
 * A ordem das alternativas é o que faz o `<!--` que aparece dentro de um
 * JavaScript embutido (`var s = "<!--"`) não ser confundido com comentário: ao
 * chegar no `<script`, a primeira alternativa consome o bloco inteiro antes de
 * a segunda ter chance de olhar para dentro dele.
 */
const COMMENT_OR_RAW_TEXT = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<!--[\s\S]*$/gi;

/**
 * Remove apenas comentários HTML, preservando todo o resto do documento.
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
const stripComments = (html: string): string =>
  html.replace(COMMENT_OR_RAW_TEXT, (match) => (match.startsWith('<!--') ? ' ' : match));

const stripNonContent = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

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

const collectJsonLdTypes = (html: string): string[] => {
  const types = new Set<string>();
  const blocks = html.match(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!blocks) return [];

  for (const block of blocks) {
    const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
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

export const parseHtml = (html: string, bytes: number): HtmlReport => {
  // O que está dentro de comentário não é elemento da página: o navegador não
  // pinta, o crawler não indexa e a auditoria não deve contar. Todas as
  // leituras de estrutura passam a partir daqui pelo `markup` sem comentários,
  // e não pelo `html` cru — a única exceção é `detectPlatform`, pelos motivos
  // documentados nela.
  const markup = stripComments(html);

  const metaTags = collectTags(markup, 'meta');

  const htmlTag = /<html\b[^>]*>/i.exec(markup)?.[0] ?? '';

  const title = clean(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(markup)?.[1] ?? null);
  const metaDescription = metaContent(metaTags, 'name', 'description');

  const h1 = [...markup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => clean(m[1].replace(/<[^>]+>/g, ' ')))
    .filter((value): value is string => value !== null);

  const imageTags = collectTags(markup, 'img');
  const images: ImageStats = {
    total: imageTags.length,
    withoutAlt: 0,
    withoutDimensions: 0,
    lazy: 0,
  };
  for (const tag of imageTags) {
    if (attr(tag, 'alt') === null) images.withoutAlt++;
    if (attr(tag, 'width') === null || attr(tag, 'height') === null) images.withoutDimensions++;
    if ((attr(tag, 'loading') ?? '').toLowerCase() === 'lazy') images.lazy++;
  }

  const scriptTags = collectTags(markup, 'script');
  const scripts: ScriptStats = {
    total: scriptTags.length,
    external: 0,
    blocking: 0,
  };
  for (const tag of scriptTags) {
    if (attr(tag, 'src') !== null) {
      scripts.external++;
      if (!hasAttr(tag, 'async') && !hasAttr(tag, 'defer') && (attr(tag, 'type') ?? '') !== 'module') {
        scripts.blocking++;
      }
    }
  }

  const linkTags = collectTags(markup, 'link');
  const relOf = (tag: string): string => (attr(tag, 'rel') ?? '').toLowerCase();

  const inlineStyleBytes = [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce(
    (total, match) => total + match[1].length,
    0,
  );

  const generator = metaContent(metaTags, 'name', 'generator');
  const textContent = stripNonContent(markup).replace(/<[^>]+>/g, ' ');
  const wordCount = decodeEntities(textContent)
    .split(/\s+/)
    .filter((word) => word.length > 1).length;

  return {
    bytes,
    lang: clean(attr(htmlTag, 'lang')),
    charset:
      clean(/<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/i.exec(markup)?.[1] ?? null) ?? null,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical: clean(
      linkTags.filter((tag) => relOf(tag) === 'canonical').map((tag) => attr(tag, 'href'))[0] ?? null,
    ),
    robotsMeta: metaContent(metaTags, 'name', 'robots'),
    viewport: metaContent(metaTags, 'name', 'viewport'),
    h1,
    h2Count: (markup.match(/<h2\b/gi) ?? []).length,
    images,
    openGraph: {
      title: metaContent(metaTags, 'property', 'og:title'),
      description: metaContent(metaTags, 'property', 'og:description'),
      image: metaContent(metaTags, 'property', 'og:image'),
    },
    twitterCard: metaContent(metaTags, 'name', 'twitter:card'),
    jsonLdTypes: collectJsonLdTypes(markup),
    favicon: linkTags.some((tag) => relOf(tag).includes('icon')),
    scripts,
    stylesheets: linkTags.filter((tag) => relOf(tag).includes('stylesheet')).length,
    inlineStyleBytes,
    generator,
    hreflang: linkTags
      .filter((tag) => relOf(tag) === 'alternate' && attr(tag, 'hreflang') !== null)
      .map((tag) => attr(tag, 'hreflang') as string),
    wordCount,
    platform: detectPlatform(html, generator),
  };
};

export interface RobotsReport {
  found: boolean;
  blocksAll: boolean;
  sitemaps: string[];
}

export const parseRobots = (body: string): RobotsReport => {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const sitemaps = lines
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.replace(/^sitemap\s*:\s*/i, '').trim())
    .filter(Boolean);

  // "Disallow: /" dentro de um bloco User-agent: * bloqueia o site inteiro.
  let inWildcardBlock = false;
  let blocksAll = false;
  for (const line of lines) {
    if (/^user-agent\s*:/i.test(line)) {
      inWildcardBlock = line.split(':')[1]?.trim() === '*';
      continue;
    }
    if (inWildcardBlock && /^disallow\s*:\s*\/\s*$/i.test(line)) blocksAll = true;
  }

  return { found: true, blocksAll, sitemaps };
};

export const countSitemapUrls = (xml: string): number => {
  const urls = (xml.match(/<loc>/gi) ?? []).length;
  return urls;
};

export const isSitemapIndex = (xml: string): boolean => /<sitemapindex/i.test(xml);
