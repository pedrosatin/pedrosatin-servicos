import { describe, it, expect, vi, afterEach } from 'vitest';
import { runAudit } from './audit';
import * as sources from './sources';
import type { DomainRegistration, ContentReport, PageSpeedReport } from './types';

describe('audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResolvedValues = () => {
    vi.spyOn(sources, 'fetchRegistration').mockResolvedValue({
      found: false,
      domain: 'example.com',
      registrar: null,
      registeredAt: null,
      expiresAt: null,
      changedAt: null,
      daysToExpire: null,
      status: [],
      nameservers: [],
      dnssec: false,
      source: null,
    } as DomainRegistration);

    vi.spyOn(sources, 'fetchContent').mockResolvedValue({
      ok: true,
      input: 'example.com',
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com',
      status: 200,
      redirects: [],
      servedOverHttps: true,
      httpRedirectsToHttps: true,
      edgeResponseMs: 100,
      server: null,
      poweredBy: null,
      cacheControl: null,
      contentEncoding: null,
      compressed: false,
      securityHeaders: {
        hsts: null,
        contentTypeOptions: null,
        frameOptions: null,
        csp: null,
        referrerPolicy: null,
        permissionsPolicy: null,
      },
      html: null,
      robots: { found: true, blocksAll: false, sitemaps: [] },
      sitemap: { found: false, url: null, urlCount: null, isIndex: false },
      checkedAt: new Date().toISOString(),
    } as ContentReport);

    vi.spyOn(sources, 'fetchPageSpeed').mockResolvedValue({
      strategy: 'mobile',
      scores: {
        performance: 90,
        seo: 90,
        accessibility: 90,
        bestPractices: 90,
      },
      lab: {
        lcpMs: null,
        fcpMs: null,
        cls: null,
        tbtMs: null,
        speedIndexMs: null,
        serverResponseMs: null,
        totalBytes: null,
      },
      field: {
        available: false,
        overall: null,
        lcp: { p75: null, category: null },
        cls: { p75: null, category: null },
        inp: { p75: null, category: null },
        origin: false,
      },
      screenshot: null,
      screenshotSize: null,
      opportunities: [],
      fetchedAt: new Date().toISOString(),
    } as PageSpeedReport);
  };

  it('should handle Error instances in runStep catch block', async () => {
    vi.spyOn(sources, 'fetchDns').mockRejectedValue(new Error('DNS fetch failed'));
    mockResolvedValues();

    const onStep = vi.fn();

    await runAudit('example.com', { onStep });

    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dns',
        status: 'failed',
        detail: 'DNS fetch failed',
      }),
    );
  });

  it('should handle non-Error instances in runStep catch block', async () => {
    vi.spyOn(sources, 'fetchDns').mockRejectedValue('String error');
    mockResolvedValues();

    const onStep = vi.fn();

    await runAudit('example.com', { onStep });

    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dns',
        status: 'failed',
        detail: 'Falha inesperada.',
      }),
    );
  });
});
