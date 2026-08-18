/**
 * Injeta o HTML renderizado no build dentro de `dist/index.html`, e mais duas
 * coisas que só existem depois que o build roda: o preload das fontes, cujos
 * nomes carregam o hash do conteúdo, e a data no `sitemap.xml`.
 *
 * Roda depois dos dois `vite build`: o do cliente, que produz o `index.html`
 * com os links de script e estilo, e o de servidor, que produz o módulo capaz
 * de renderizar o componente em texto.
 */

import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { render } from '../dist-ssr/entry-server.js';

const dist = new URL('../dist/', import.meta.url);
const page = new URL('index.html', dist);
const sitemap = new URL('sitemap.xml', dist);
const ssrDir = new URL('../dist-ssr/', import.meta.url);
const marker = '<div id="root"></div>';

let html = await readFile(page, 'utf8');

// Se o marcador mudar, o build precisa falhar em vez de publicar a casca vazia.
if (!html.includes(marker)) {
  throw new Error(`Marcador ${marker} não encontrado em dist/index.html.`);
}

/* ---------- 1. o texto da página ---------- */

const body = render();
html = html.replace(marker, `<div id="root">${body}</div>`);

/* ---------- 2. preload das fontes ---------- */

// As fontes só são descobertas depois que o navegador baixa e lê a folha de
// estilo, o que atrasa o primeiro texto na fonte certa. O preload as pede junto
// com o CSS. O nome do arquivo tem o hash do conteúdo, então ele só é conhecido
// aqui, e um nome errado seria um download inútil: por isso o build falha se
// nenhum arquivo aparecer.
const assets = await readdir(new URL('assets/', dist));
const fonts = assets.filter((name) => name.endsWith('.woff2'));

if (fonts.length === 0) {
  throw new Error('Nenhuma fonte .woff2 em dist/assets/. O import em index.css saiu?');
}

const preloads = fonts
  .map(
    (name) =>
      `<link rel="preload" href="/assets/${name}" as="font" type="font/woff2" crossorigin />`,
  )
  .join('\n    ');

html = html.replace('</head>', `  ${preloads}\n  </head>`);

await writeFile(page, html);

/* ---------- 3. data do sitemap ---------- */

// `lastmod` escrito à mão envelhece e passa a mentir para o buscador. A data do
// build é a data em que o conteúdo publicado mudou de fato.
const today = new Date().toISOString().slice(0, 10);
const xml = await readFile(sitemap, 'utf8');
await writeFile(sitemap, xml.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`));

await rm(ssrDir, { recursive: true, force: true });

const words = body
  .replace(/<[^>]*>/g, ' ')
  .trim()
  .split(/\s+/).length;
console.log(
  `prerender: ${words} palavras, ${fonts.length} fonte(s) em preload, sitemap em ${today}`,
);
