import { describe, it, expect } from 'vitest';
import { parseHtml, parseRobots, countSitemapUrls } from './parse';

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
});
