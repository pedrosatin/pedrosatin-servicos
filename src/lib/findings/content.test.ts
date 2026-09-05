import { describe, it, expect, vi } from 'vitest';
import { buildContentFindings } from './content';
import type { AuditResult } from '../types';

describe('buildContentFindings', () => {
  it('identifies when robots.txt blocks all', () => {
    const push = vi.fn();
    const result = {
      content: {
        robots: { blocksAll: true },
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'robots-bloqueia', severity: 'critical' })
    );
  });

  it('identifies missing robots.txt', () => {
    const push = vi.fn();
    const result = {
      content: {
        finalUrl: 'https://example.com/',
        robots: { found: false },
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'robots-ausente', severity: 'info' })
    );
  });

  it('identifies missing sitemap', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: false },
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sitemap-ausente', severity: 'warning' })
    );
  });

  it('identifies valid sitemap', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true, url: 'https://example.com/sitemap.xml', urlCount: 10, isIndex: false },
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sitemap-ok', severity: 'good' })
    );
  });

  it('identifies meta noindex', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  robotsMeta: 'noindex, nofollow' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meta-noindex', severity: 'critical' })
    );
  });

  it('identifies missing title', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: null }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'title-ausente', severity: 'critical' })
    );
  });

  it('identifies long title', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'A very long title that exceeds the 65 character limit typically displayed by Google', titleLength: 83 }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'title-longo', severity: 'warning' })
    );
  });

  it('identifies short title', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'Short', titleLength: 5 }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'title-curto', severity: 'warning' })
    );
  });

  it('identifies missing meta description', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'OK title', titleLength: 30, metaDescription: null }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'description-ausente', severity: 'warning' })
    );
  });

  it('identifies long meta description', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'OK title', titleLength: 30, metaDescription: 'A very long description that exceeds the normal 155 character space available on most search engines. This is going to be truncated and will show an ellipsis at the end.', metaDescriptionLength: 172 }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'description-longa', severity: 'info' })
    );
  });

  it('identifies missing canonical', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true }, // Prevent Cannot read properties of undefined (reading 'found')
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {},  title: 'OK title', titleLength: 30, metaDescription: 'OK description', metaDescriptionLength: 50, canonical: null }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'canonical-ausente', severity: 'warning' })
    );
  });

  it('identifies missing H1', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: [], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h1-ausente', severity: 'warning' })
    );
  });

  it('identifies multiple H1s', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['Title 1', 'Title 2'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h1-multiplo', severity: 'info' })
    );
  });

  it('identifies JS dependent content (critical)', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 50, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conteudo-dependente-js', severity: 'critical' })
    );
  });

  it('identifies JS dependent content (warning)', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 150, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conteudo-dependente-js', severity: 'warning' })
    );
  });

  it('identifies missing structured data', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sem-dados-estruturados', severity: 'info' })
    );
  });

  it('identifies valid structured data', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: ['LocalBusiness'], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: {}, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dados-estruturados-ok', severity: 'good' })
    );
  });

  it('identifies missing open graph tags', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: null, image: null }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'og-ausente', severity: 'warning' })
    );
  });

  it('identifies missing viewport', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: null }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'viewport-ausente', severity: 'critical' })
    );
  });

  it('identifies blocked zoom in viewport', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width, maximum-scale=1' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'zoom-bloqueado', severity: 'warning' })
    );
  });

  it('identifies images missing alt attributes', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 5, withoutAlt: 2 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'imagens-sem-alt', severity: 'info' })
    );
  });

  it('identifies images missing dimensions', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 5, withoutDimensions: 3 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'imagens-sem-dimensao', severity: 'warning' })
    );
  });

  it('identifies blocking scripts (info)', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 2, total: 2, external: 2 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scripts-bloqueantes', severity: 'info' })
    );
  });

  it('identifies blocking scripts (warning)', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 5, total: 5, external: 5 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width' }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scripts-bloqueantes', severity: 'warning' })
    );
  });

  it('identifies missing lang attribute', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width', lang: null }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lang-ausente', severity: 'info' })
    );
  });

  it('identifies heavy HTML', () => {
    const push = vi.fn();
    const result = {
      content: {
        sitemap: { found: true },
        html: { h1: ['A'], jsonLdTypes: [], images: { total: 0 }, scripts: { blocking: 0 }, openGraph: { title: 'A', image: 'B' }, title: 'A', metaDescription: 'B', canonical: 'C', wordCount: 300, viewport: 'width=device-width', lang: 'pt', bytes: 600000 }
      },
    } as unknown as AuditResult;

    buildContentFindings(result, push);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'html-pesado', severity: 'warning' })
    );
  });
});
