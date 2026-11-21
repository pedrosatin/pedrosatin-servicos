import { describe, it, expect } from 'vitest';
import { buildContentFindings } from './content';
import type { AuditResult } from '../types';

describe('buildContentFindings', () => {
  it('identifies when robots.txt blocks all', () => {
    const result = {
      content: {
        robots: { blocksAll: true },
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'robots-bloqueia', severity: 'critical' })
    );
  });

  it('identifies missing robots.txt', () => {
    const result = {
      content: {
        finalUrl: 'https://example.com/',
        robots: { found: false },
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'robots-ausente', severity: 'info' })
    );
  });

  it('identifies missing sitemap', () => {
    const result = {
      content: {
        sitemap: { found: false },
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'sitemap-ausente', severity: 'warning' })
    );
  });

  it('reports an unverified sitemap instead of a missing one when the lookup failed', () => {
    const result = {
      content: {
        sitemap: { found: false, url: null, urlCount: null, isIndex: false, error: 'Não foi possível consultar o sitemap.' },
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'sitemap-nao-verificado', severity: 'info' })
    );
    expect(findings).not.toContainEqual(expect.objectContaining({ id: 'sitemap-ausente' }));
  });

  it('identifies valid sitemap', () => {
    const result = {
      content: {
        sitemap: { found: true, url: 'https://example.com/sitemap.xml', urlCount: 10, isIndex: false },
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'sitemap-ok', severity: 'good' })
    );
  });

  it('identifies meta noindex', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  robotsMeta: 'noindex, nofollow' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'meta-noindex', severity: 'critical' })
    );
  });

  it('identifies missing title', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: null }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'title-ausente', severity: 'critical' })
    );
  });

  it('identifies long title', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'A very long title that exceeds the 65 character limit typically displayed by Google', titleLength: 83 }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'title-longo', severity: 'warning' })
    );
  });

  it('identifies short title', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'Short', titleLength: 5 }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'title-curto', severity: 'warning' })
    );
  });

  it('identifies missing meta description', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'OK title', titleLength: 30, metaDescription: null }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'description-ausente', severity: 'warning' })
    );
  });

  it('identifies long meta description', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'OK title', titleLength: 30, metaDescription: 'A very long description that exceeds the normal 155 character space available on most search engines. This is going to be truncated and will show an ellipsis at the end.', metaDescriptionLength: 172 }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'description-longa', severity: 'info' })
    );
  });

  it('identifies missing canonical', () => {
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'OK title', titleLength: 30, metaDescription: 'OK description', metaDescriptionLength: 50, canonical: null }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'canonical-ausente', severity: 'warning' })
    );
  });

  it('identifies missing H1', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'h1-ausente', severity: 'warning' })
    );
  });

  it('identifies multiple H1s', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['Title 1', 'Title 2'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'h1-multiplo', severity: 'info' })
    );
  });

  it('identifies JS dependent content (critical)', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 50, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'conteudo-dependente-js', severity: 'critical' })
    );
  });

  it('identifies JS dependent content (warning)', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 150, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'conteudo-dependente-js', severity: 'warning' })
    );
  });

  it('identifies missing structured data', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'sem-dados-estruturados', severity: 'info' })
    );
  });

  it('identifies valid structured data', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: ['LocalBusiness'], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'dados-estruturados-ok', severity: 'good' })
    );
  });

  it('identifies missing open graph tags', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: null, image: null }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'og-ausente', severity: 'warning' })
    );
  });

  it('identifies missing viewport', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: null }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'viewport-ausente', severity: 'critical' })
    );
  });

  it('identifies blocked zoom in viewport', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width, maximum-scale=1' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'zoom-bloqueado', severity: 'warning' })
    );
  });

  it('identifies images missing alt attributes', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 5, withoutAlt: 2 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'imagens-sem-alt', severity: 'info' })
    );
  });

  it('identifies images missing dimensions', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 5, withoutDimensions: 3 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'imagens-sem-dimensao', severity: 'warning' })
    );
  });

  it('identifies blocking scripts (info)', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 2, total: 2, external: 2 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'scripts-bloqueantes', severity: 'info' })
    );
  });

  it('identifies blocking scripts (warning)', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 5, total: 5, external: 5 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'scripts-bloqueantes', severity: 'warning' })
    );
  });

  it('identifies missing lang attribute', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width', lang: null }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'lang-ausente', severity: 'info' })
    );
  });

  it('identifies heavy HTML', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width', lang: 'pt', bytes: 600000 }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({
        id: 'html-pesado',
        severity: 'warning',
        evidence: expect.stringContaining('586 KB'),
      })
    );
  });
  it('says the HTML is larger than the read ceiling when the Worker truncated it', () => {
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width', lang: 'pt', bytes: 3_000_000 }
      },
    } as unknown as AuditResult;

    const findings = buildContentFindings(result);

    expect(findings).toContainEqual(
      expect.objectContaining({ id: 'html-pesado', evidence: expect.stringContaining('mais de 2.9 MB') })
    );
  });
});
