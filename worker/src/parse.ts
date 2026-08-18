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

/** Lê o valor de um atributo dentro de uma tag isolada. */
const attr = (tag: string, name: string): string | null => {
  const doubleQuoted = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  if (doubleQuoted) return doubleQuoted[1];
  const singleQuoted = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag);
  if (singleQuoted) return singleQuoted[1];
  const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s">]+)`, 'i').exec(tag);
  return bare ? bare[1] : null;
};

const hasAttr = (tag: string, name: string): boolean =>
  new RegExp(`\\b${name}\\b`, 'i').test(tag);

/** Todas as tags de um tipo, com o conteúdo interno quando houver. */
const collectTags = (html: string, tagName: string): string[] =>
  html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];

const metaContent = (html: string, keyAttr: 'name' | 'property', key: string): string | null => {
  const tags = collectTags(html, 'meta');
  for (const tag of tags) {
    const found = attr(tag, keyAttr);
    if (found && found.toLowerCase() === key.toLowerCase()) {
      return clean(attr(tag, 'content'));
    }
  }
  return null;
};

const stripNonContent = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

const detectPlatform = (html: string, generator: string | null): string | null => {
  const lowered = html.toLowerCase();
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
  if (lowered.includes('/wp-content/') || lowered.includes('/wp-includes/')) return 'WordPress';
  if (lowered.includes('static.parastorage.com') || lowered.includes('wix.com')) return 'Wix';
  if (lowered.includes('cdn.shopify.com')) return 'Shopify';
  if (lowered.includes('squarespace.com')) return 'Squarespace';
  if (lowered.includes('webflow.com')) return 'Webflow';
  if (lowered.includes('_next/static')) return 'Next.js';
  if (lowered.includes('/_astro/')) return 'Astro';
  if (lowered.includes('lojaintegrada')) return 'Loja Integrada';
  if (lowered.includes('rdstation')) return 'RD Station';
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
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';

  const title = clean(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null);
  const metaDescription = metaContent(html, 'name', 'description');

  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => clean(m[1].replace(/<[^>]+>/g, ' ')))
    .filter((value): value is string => value !== null);

  const imageTags = collectTags(html, 'img');
  const images: ImageStats = {
    total: imageTags.length,
    withoutAlt: imageTags.filter((tag) => attr(tag, 'alt') === null).length,
    withoutDimensions: imageTags.filter(
      (tag) => attr(tag, 'width') === null || attr(tag, 'height') === null,
    ).length,
    lazy: imageTags.filter((tag) => (attr(tag, 'loading') ?? '').toLowerCase() === 'lazy').length,
  };

  const scriptTags = collectTags(html, 'script');
  const externalScripts = scriptTags.filter((tag) => attr(tag, 'src') !== null);
  const scripts: ScriptStats = {
    total: scriptTags.length,
    external: externalScripts.length,
    blocking: externalScripts.filter(
      (tag) => !hasAttr(tag, 'async') && !hasAttr(tag, 'defer') && (attr(tag, 'type') ?? '') !== 'module',
    ).length,
  };

  const linkTags = collectTags(html, 'link');
  const relOf = (tag: string): string => (attr(tag, 'rel') ?? '').toLowerCase();

  const inlineStyleBytes = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce(
    (total, match) => total + match[1].length,
    0,
  );

  const generator = metaContent(html, 'name', 'generator');
  const textContent = stripNonContent(html).replace(/<[^>]+>/g, ' ');
  const wordCount = decodeEntities(textContent)
    .split(/\s+/)
    .filter((word) => word.length > 1).length;

  return {
    bytes,
    lang: clean(attr(htmlTag, 'lang')),
    charset:
      clean(/<meta\b[^>]*charset\s*=\s*["']?([^"'\s>]+)/i.exec(html)?.[1] ?? null) ?? null,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical: clean(
      linkTags.filter((tag) => relOf(tag) === 'canonical').map((tag) => attr(tag, 'href'))[0] ?? null,
    ),
    robotsMeta: metaContent(html, 'name', 'robots'),
    viewport: metaContent(html, 'name', 'viewport'),
    h1,
    h2Count: (html.match(/<h2\b/gi) ?? []).length,
    images,
    openGraph: {
      title: metaContent(html, 'property', 'og:title'),
      description: metaContent(html, 'property', 'og:description'),
      image: metaContent(html, 'property', 'og:image'),
    },
    twitterCard: metaContent(html, 'name', 'twitter:card'),
    jsonLdTypes: collectJsonLdTypes(html),
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
