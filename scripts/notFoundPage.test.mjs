import { describe, expect, test } from 'vitest';
import { buildNotFoundHtml } from './notFoundPage.mjs';

const SAMPLE_SHELL = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Publicação, Deploy e Engenharia para Projetos criados com IA | Pedro Satin</title>
    <meta name="description" content="Descrição da home." />
    <link rel="canonical" href="https://servicos.pedrosatin.com/" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="Home" />
    <meta name="twitter:title" content="Home" />
    <meta property="profile:username" content="pedrosatin" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="alternate" type="application/json+oembed" href="https://servicos.pedrosatin.com/oembed.json" />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-def.css">
    <link rel="preload" href="/assets/inter-latin-ghi.woff2" as="font" type="font/woff2" crossorigin />
  </head>
  <body>
    <div id="root"></div>
    <noscript><p>Aviso JS</p></noscript>
  </body>
</html>`;

describe('buildNotFoundHtml', () => {
  test('remove metas da home mesmo com content antes de name ou property', () => {
    const shell = SAMPLE_SHELL.replace(
      '<meta name="twitter:title" content="Home" />',
      '<meta content="summary_large_image" name="twitter:card" />\n    <meta content="Home" property="og:description" />',
    );
    const html = buildNotFoundHtml(shell);
    expect(html).not.toContain('twitter:card');
    expect(html).not.toContain('og:description');
  });

  test('gera 404 estática com noindex, links esperados, CSS/fontes e sem script do app', () => {
    const html = buildNotFoundHtml(SAMPLE_SHELL);

    expect(html).toContain('<title>Página não encontrada | Pedro Satin</title>');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('href="/favicon.svg"');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).toContain('href="/assets/index-def.css"');
    expect(html).toContain('href="/assets/inter-latin-ghi.woff2"');
    expect(html).toContain('<h1 class="lp-title">Página não encontrada</h1>');
    expect(html).toContain('href="/">Voltar para a home</a>');
    expect(html).toContain('href="/#analise">Analisar um site</a>');

    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:');
    expect(html).not.toContain('name="twitter:');
    expect(html).not.toContain('property="profile:');
    expect(html).not.toContain('application/json+oembed');
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain('<noscript>');
    expect(html).not.toContain('style=');
  });

  test('falha quando o marcador root não existe na casca', () => {
    expect(() => buildNotFoundHtml('<html><body></body></html>')).toThrow(/Marcador/);
  });
});
