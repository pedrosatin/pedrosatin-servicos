import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DomainRegistration, ContentReport, PageSpeedReport } from './types';
import { runAudit } from './audit';
import * as sources from './sources';

describe('audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResolvedValues = () => {
    const mockRegistration: DomainRegistration = {
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
    };

    const mockContent: ContentReport = {
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
      compressed: true,
      securityHeaders: {
        hsts: null,
        contentTypeOptions: null,
        frameOptions: null,
        csp: null,
        referrerPolicy: null,
        permissionsPolicy: null,
      },
      html: null,
      robots: { found: false, blocksAll: false, sitemaps: [] },
      sitemap: { found: false, url: null, urlCount: null, isIndex: false },
      checkedAt: new Date().toISOString(),
    };

    const mockPageSpeed: PageSpeedReport = {
      strategy: 'mobile',
      scores: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 90,
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
    };

    vi.spyOn(sources, 'fetchRegistration').mockResolvedValue(mockRegistration);
    vi.spyOn(sources, 'fetchContent').mockResolvedValue(mockContent);
    vi.spyOn(sources, 'fetchPageSpeed').mockResolvedValue(mockPageSpeed);
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
