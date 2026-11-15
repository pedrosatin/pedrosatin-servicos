import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export function styleHash(css) {
  return `'sha256-${createHash('sha256').update(css).digest('base64')}'`;
}

export function authorizeStyles(headers, css) {
  if (!headers.includes("style-src 'self';")) {
    throw new Error('Diretiva style-src esperada ausente.');
  }
  return headers.replace("style-src 'self';", `style-src 'self' ${styleHash(css)};`);
}

/** Usa os mesmos bytes no HTML e no hash autorizado pela CSP. */
export async function inlineStyles(dist) {
  let html = await readFile(new URL('index.html', dist), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  if (!links.length) throw new Error('Folha de estilo ausente no build.');
  let headers = await readFile(new URL('_headers', dist), 'utf8');
  const styles = [];
  for (const [tag] of links) {
    const href = tag.match(/href="\/([^"]+)"/)[1];
    const css = await readFile(new URL(href, dist), 'utf8');
    styles.push(css);
    html = html.replace(tag, '');
  }
  const css = styles.join('\n');
  headers = authorizeStyles(headers, css);
  html = html.replace('</head>', () => `<style>${css}</style>\n</head>`);
  await writeFile(new URL('_headers', dist), headers);
  return html;
}
