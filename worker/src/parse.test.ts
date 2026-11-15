import { describe, it, expect } from 'vitest';
import { parseHtml, parseRobots, countSitemapUrls, isSitemapIndex } from './parse';

describe('worker parse', () => {
  it('extracts metadata and handles malformed JSON-LD gracefully', () => {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <title>Teste de Auditoria</title>
          <meta name="description" content="Descrição da página">
          <meta property="og:title" content="OG Title">
          <meta name="robots" content="index, follow">
          <link rel="canonical" href="https://example.com/">
          <link rel="icon" href="/favicon.ico">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Empresa Teste",
              invalid_trailing:
            }
          </script>
        </head>
        <body>
          <h1>Título Principal</h1>
          <img src="/foto.jpg" alt="Foto" width="100" height="100" loading="lazy">
          <img src="/sem-alt.jpg">
          <script src="/app.js" defer></script>
          <script src="/blocking.js"></script>
        </body>
      </html>
    `;

    const report = parseHtml(html, 500);

    expect(report.title).toBe('Teste de Auditoria');
    expect(report.metaDescription).toBe('Descrição da página');
    expect(report.canonical).toBe('https://example.com/');
    expect(report.favicon).toBe(true);
    expect(report.h1).toEqual(['Título Principal']);
    expect(report.images.total).toBe(2);
    expect(report.images.withoutAlt).toBe(1);
    expect(report.images.lazy).toBe(1);
    expect(report.scripts.total).toBe(3);
    expect(report.scripts.external).toBe(2);
    expect(report.scripts.blocking).toBe(1);
    expect(report.jsonLdTypes).toEqual(['Organization']);
  });


  it('recovers @type from completely invalid JSON-LD using fallback regex', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Broken JSON
          "description": "This is missing a quote
          "@type": "Offer"
        }
      </script>
    `;
    const report = parseHtml(html, 100);
    expect(report.jsonLdTypes).toEqual(['Product', 'Offer']);
  });

  it('parses robots.txt directives correctly', () => {
    const robots = `
      User-agent: *
      Disallow: /admin/
      Sitemap: https://example.com/sitemap.xml
    `;
    const report = parseRobots(robots);
    expect(report.found).toBe(true);
    expect(report.blocksAll).toBe(false);
    expect(report.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('counts sitemap URLs correctly', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/sobre</loc></url>
        <url><loc>https://example.com/contato</loc></url>
      </urlset>
    `;
    expect(countSitemapUrls(xml)).toBe(3);
  });

  it('detects sitemap index correctly', () => {
    const sitemapIndexXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
      </sitemapindex>
    `;
    const urlsetXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
      </urlset>
    `;

    expect(isSitemapIndex(sitemapIndexXml)).toBe(true);
    expect(isSitemapIndex(urlsetXml)).toBe(false);
  });
  it('safely handles malicious attributes without causing ReDoS', () => {
    // Attack vector: an attribute name with many unescaped regex special characters
    // that without escaping would cause the RegExp engine to backtrack heavily or crash
    const maliciousAttrName = 'a.*b.*c.*d.*e.*f.*g.*h.*i.*j.*k.*l.*m.*n.*o.*p.*q.*r.*s.*t.*u.*v.*w.*x.*y.*z.*';
    const tag = `<img src="test.jpg" ${maliciousAttrName}="true">`;

    // Should not hang/timeout and should return false because it searches for exact match
    const start = Date.now();

    // Test the parsing function directly if possible, or parseHtml which uses it
    const html = `<!DOCTYPE html><html><body>${tag}</body></html>`;
    const report = parseHtml(html, 100);

    expect(Date.now() - start).toBeLessThan(100); // Should be very fast
    expect(report.images.total).toBe(1);
  });

  // O HTML vem do site auditado. Com as regex anteriores, 100 KB destes padrões
  // custavam segundos de CPU e o tempo crescia com o quadrado do tamanho.
  describe('custo linear com HTML hostil', () => {
    const SIZE = 300_000;
    const hostile = (unit: string) => unit.repeat(Math.ceil(SIZE / unit.length)).slice(0, SIZE);

    for (const unit of ['<', '<meta', '<script>', '<style>', '<title>', '<h1>', '<h1><', '<!--', '<noscript>',
      '<script type="application/ld+json">', '<meta charset', '<<>']) {
      it(`processa 300 KB de ${JSON.stringify(unit)} em menos de 200 ms`, () => {
        const html = hostile(unit);
        // Melhor de três, para que a carga da máquina de CI não derrube o teste.
        // A versão quadrática levava segundos em cada rodada.
        let best = Infinity;
        for (let round = 0; round < 3; round++) {
          const start = performance.now();
          expect(parseHtml(html, html.length).bytes).toBe(SIZE);
          best = Math.min(best, performance.now() - start);
        }
        expect(best).toBeLessThan(200);
      });
    }
  });

  it('keeps the regex semantics for unclosed and nested markup', () => {
    const html = [
      '<html lang="pt"><head><META CHARSET="utf-8">',
      '<title>Primeiro</title><title>Segundo</title>',
      '<script>var s = "<!-- não é comentário";</script >',
      '<!-- <img src="comentada.jpg"> -->',
      '<style>a{}</style><style>b{}</STYLE>',
      '<script type="text/plain"><script type="application/ld+json">{"@type":"Inner"}</script>',
      '</head><body><h1>Um <b>título</b></h1><h1><>x</h1>',
      '<noscript><p>escondido</p></noscript><p>texto visível</p>',
      '<h1>sem fechamento <img src="x.jpg"',
    ].join('');
    const report = parseHtml(html, html.length);
    expect(report.lang).toBe('pt');
    expect(report.charset).toBe('utf-8');
    expect(report.title).toBe('Primeiro');
    expect(report.h1).toEqual(['Um título', '<>x']);
    expect(report.images.total).toBe(0);
    expect(report.inlineStyleBytes).toBe(6);
    expect(report.jsonLdTypes).toEqual(['Inner']);
    expect(report.scripts.total).toBe(3);
  });

  it('drops everything after an unclosed comment', () => {
    const report = parseHtml('<title>ok</title><!-- <h1>fora</h1><img src="a.jpg">', 10);
    expect(report.title).toBe('ok');
    expect(report.h1).toEqual([]);
    expect(report.images.total).toBe(0);
  });
  describe('JSON-LD aninhado', () => {
    const ldScript = (body: string) => `<script type="application/ld+json">${body}</script>`;
    const types = (body: string) => parseHtml(ldScript(body), body.length).jsonLdTypes;
    // Cada nível é um objeto com `@type` e um `@graph` que contém o próximo.
    const nested = (levels: number) => {
      let body = '{"@type":"Fundo"}';
      for (let level = levels; level >= 1; level--) body = `{"@type":"N${level}","@graph":[${body}]}`;
      return body;
    };

    it('lê os tipos de um `@graph` e de arrays aninhados como antes', () => {
      expect(types('[{"@type":["A","B"]},[{"@type":"C"}],{"@graph":[{"@type":"D"},{"@type":7}]}]')).toEqual([
        'A', 'B', 'C', 'D',
      ]);
    });

    it('ignora o que passa de 32 níveis de `@graph` e mantém o que está antes', () => {
      const found = types(nested(100));
      expect(found).toHaveLength(33);
      expect(found[0]).toBe('N1');
      expect(found).toContain('N32');
      expect(found).not.toContain('N34');
      expect(found).not.toContain('Fundo');
    });

    it('ignora, sem exceção, 100.000 níveis de arrays e de `@graph`', () => {
      const levels = 100_000;
      const arrays = '['.repeat(levels) + '{"@type":"Fundo"}' + ']'.repeat(levels);
      const graphs = '{"@graph":['.repeat(levels) + '{"@type":"Fundo"}' + ']}'.repeat(levels);
      for (const body of [arrays, graphs]) {
        expect(() => parseHtml(ldScript(body), body.length)).not.toThrow();
        expect(types(body)).toEqual([]);
      }
    });

    it('não conta colchetes de dentro de strings como aninhamento', () => {
      const text = '[[[['.repeat(200) + '\\"]]]]';
      expect(types(JSON.stringify({ '@type': 'Real', note: text }))).toEqual(['Real']);
    });

    it('lê 3 MB de colchetes abertos em menos de 200 ms', () => {
      const html = ldScript('['.repeat(1_500_000) + ']'.repeat(1_500_000));
      let best = Infinity;
      for (let round = 0; round < 3; round++) {
        const start = performance.now();
        expect(parseHtml(html, html.length).jsonLdTypes).toEqual([]);
        best = Math.min(best, performance.now() - start);
      }
      expect(best).toBeLessThan(200);
    });
  });
});

describe('detecção de plataforma', () => {
  const platformOf = (html: string) => parseHtml(html, html.length).platform;
  const withGenerator = (generator: string) => `<meta name="generator" content="${generator}">`;

  it.each([
    ['WordPress 6.5', 'WordPress'],
    ['Wix.com Website Builder', 'Wix'],
    ['Joomla! - Open Source', 'Joomla'],
    ['Drupal 10', 'Drupal'],
    ['Astro v4.0', 'Astro'],
    ['Hugo 0.120', 'Hugo'],
    ['Gatsby 5.0', 'Gatsby'],
  ])('reconhece pelo generator "%s"', (generator, platform) => {
    expect(platformOf(withGenerator(generator))).toBe(platform);
  });

  it.each([
    ['<link href="/wp-content/themes/a.css">', 'WordPress'],
    ['<script src="/wp-includes/js/a.js"></script>', 'WordPress'],
    ['<script src="https://static.parastorage.com/a.js"></script>', 'Wix'],
    ['<link href="https://static.wixstatic.com/a.css"> wix.com', 'Wix'],
    ['<script src="https://cdn.shopify.com/s/a.js"></script>', 'Shopify'],
    ['<script src="https://static1.squarespace.com/a.js"></script>', 'Squarespace'],
    ['<script src="https://assets.webflow.com/a.js"></script>', 'Webflow'],
    ['<script src="/_next/static/chunks/a.js"></script>', 'Next.js'],
    ['<script type="module" src="/_astro/a.js"></script>', 'Astro'],
    ['<img src="https://cdn.lojaintegrada.com.br/a.png">', 'Loja Integrada'],
    ['<script src="https://d335luupugsy2.cloudfront.net/rdstation.js"></script>', 'RD Station'],
  ])('reconhece pelo conteúdo %s', (html, platform) => {
    expect(platformOf(html)).toBe(platform);
  });

  it('devolve null sem generator conhecido nem assinatura', () => {
    expect(platformOf('<p>Site comum</p>')).toBeNull();
    expect(platformOf(withGenerator('Editor Próprio 1.0'))).toBeNull();
  });

  it('prefere o generator às assinaturas do conteúdo', () => {
    expect(platformOf(`${withGenerator('Hugo 0.120')}<script src="/wp-content/a.js"></script>`)).toBe('Hugo');
  });

  it('lê assinatura dentro de comentário, que o resto da análise ignora', () => {
    expect(platformOf('<!-- cache em /wp-content/cache/ --><p>oi</p>')).toBe('WordPress');
  });
});

describe('relatório completo', () => {
  it('fixa o resultado de um documento com todos os grupos de campos', () => {
    const html = `<!-- <h2>fora</h2> -->
<html lang=" pt-BR ">
<head>
<meta charset="utf-8">
<title> A &amp; B </title>
<meta name="description" content="Descrição">
<meta name="Robots" content="noindex">
<meta name="viewport" content="width=device-width">
<meta name="twitter:card" content="summary">
<meta property="og:title" content="OG T">
<meta property="og:description" content="OG D">
<meta property="og:image" content="/og.png">
<meta name="generator" content="Hugo 0.1">
<link rel="canonical" href=" https://x.com/ ">
<link rel="canonical" href="https://outra.com/">
<link rel="shortcut icon" href="/f.ico">
<link rel="stylesheet" href="/a.css">
<link rel="alternate" hreflang="en" href="/en">
<link rel="alternate" href="/feed">
<style>body{margin:0}</style>
<script type="application/ld+json">{"@type":["Organization","WebSite"]}</script>
<script src="/a.js"></script><script async src="/b.js"></script><script type="module" src="/c.js"></script>
</head>
<body>
<h1>Um <b>título</b></h1><h1> </h1><h2>a</h2><h2>b</h2>
<img src="/1.png" alt="" width="1" height="1" loading="lazy"><img src="/2.png" width="1">
<noscript>nao conta</noscript>
<p>Duas palavras &amp; mais x</p>
</body></html>`;

    expect(parseHtml(html, 1234)).toEqual({
      bytes: 1234,
      lang: 'pt-BR',
      charset: 'utf-8',
      title: 'A & B',
      titleLength: 5,
      metaDescription: 'Descrição',
      metaDescriptionLength: 9,
      canonical: 'https://x.com/',
      robotsMeta: 'noindex',
      viewport: 'width=device-width',
      h1: ['Um título'],
      h2Count: 2,
      images: { total: 2, withoutAlt: 1, withoutDimensions: 1, lazy: 1 },
      openGraph: { title: 'OG T', description: 'OG D', image: '/og.png' },
      twitterCard: 'summary',
      jsonLdTypes: ['Organization', 'WebSite'],
      favicon: true,
      scripts: { total: 4, external: 3, blocking: 1 },
      stylesheets: 1,
      inlineStyleBytes: 14,
      generator: 'Hugo 0.1',
      hreflang: ['en'],
      wordCount: 5,
      platform: 'Hugo',
    });
  });
});
