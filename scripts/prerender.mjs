
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { inlineStyles } from './inlineStyles.mjs';
import { faltasNoSsr, render } from '../dist-ssr/entry-server.js';
import { buildNotFoundHtml, ROOT_MARKER } from './notFoundPage.mjs';

const dist = new URL('../dist/', import.meta.url);
const page = new URL('index.html', dist);
const notFoundPage = new URL('404.html', dist);
const sitemap = new URL('sitemap.xml', dist);
const ssrDir = new URL('../dist-ssr/', import.meta.url);

async function collectFontPreloads(distDir) {
  const assets = await readdir(new URL('assets/', distDir));
  const fonts = assets.filter((name) => name.endsWith('.woff2'));

  if (fonts.length === 0) {
    throw new Error('Nenhuma fonte .woff2 em dist/assets/. O import em index.css saiu?');
  }

  const tags = fonts
    .map(
      (name) =>
        `<link rel="preload" href="/assets/${name}" as="font" type="font/woff2" crossorigin />`,
    )
    .join('\n    ');

  return { tags, count: fonts.length };
}

async function updateSitemapDate(sitemapPath, today) {
  const xml = await readFile(sitemapPath, 'utf8');
  const updated = xml.replace(/<lastmod>[^<]*<\/lastmod>/, () => `<lastmod>${today}</lastmod>`);
  await writeFile(sitemapPath, updated);
}

function assertCompleteBody(body) {
  const faltas = faltasNoSsr(body);
  if (faltas.length > 0) {
    throw new Error(`SSR incompleto. Falta: ${faltas.join(', ')}.`);
  }
}

function countWords(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .split(/\s+/).length;
}

const template = await inlineStyles(dist);

if (!template.includes(ROOT_MARKER)) {
  throw new Error(`Marcador ${ROOT_MARKER} não encontrado em dist/index.html.`);
}

const { tags: preloads, count: fontCount } = await collectFontPreloads(dist);
const shellHtml = template.replace('</head>', () => `  ${preloads}\n  </head>`);

const body = render();
assertCompleteBody(body);
const indexHtml = shellHtml.replace(ROOT_MARKER, () => `<div id="root">${body}</div>`);
await writeFile(page, indexHtml);

const notFoundHtml = buildNotFoundHtml(shellHtml);
await writeFile(notFoundPage, notFoundHtml);

const today = new Date().toISOString().slice(0, 10);
await updateSitemapDate(sitemap, today);
await rm(ssrDir, { recursive: true, force: true });

console.log(
  `prerender: ${countWords(body)} palavras, ${fontCount} fonte(s) em preload, 404.html gerada, sitemap em ${today}`,
);
