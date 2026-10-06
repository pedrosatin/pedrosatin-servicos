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
});
