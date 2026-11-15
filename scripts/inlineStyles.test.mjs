// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { authorizeStyles, inlineStyles } from './inlineStyles.mjs';
import { buildNotFoundHtml } from './notFoundPage.mjs';

let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

test('autoriza os bytes exatos do estilo da home e da 404 sem link bloqueante', async () => {
  directory = await mkdtemp(`${tmpdir()}/inline-css-`);
  const dist = pathToFileURL(`${directory}/`);
  await mkdir(new URL('assets/', dist));
  const css = 'body{color:red}/* acentuação $& */';
  await writeFile(new URL('assets/site.css', dist), css);
  await writeFile(new URL('_headers', dist), "/*\n  Content-Security-Policy: style-src 'self';");
  await writeFile(new URL('index.html', dist), '<head><meta name="robots" content="index" /><link rel="stylesheet" href="/assets/site.css"></head><div id="root"></div>');
  const html = await inlineStyles(dist);
  const headers = await readFile(new URL('_headers', dist), 'utf8');
  for (const page of [html, buildNotFoundHtml(html)]) {
    const embedded = page.match(/<style>([\s\S]*?)<\/style>/)[1];
    expect(embedded).toBe(css);
    expect(headers).toContain(`'sha256-${createHash('sha256').update(embedded).digest('base64')}'`);
    expect(page).not.toContain('rel="stylesheet"');
  }
  expect(headers).not.toContain('unsafe-inline');
});

test('recusa CSP sem a diretiva esperada', () => {
  expect(() => authorizeStyles('default-src self', 'body{}')).toThrow(/style-src/);
});

test('recusa build sem CSS', async () => {
  directory = await mkdtemp(`${tmpdir()}/inline-css-`);
  await writeFile(`${directory}/index.html`, '<head></head>');
  await expect(inlineStyles(pathToFileURL(`${directory}/`))).rejects.toThrow(/ausente/);
});
