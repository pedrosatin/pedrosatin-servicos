import { describe, it, expect, vi, afterEach } from 'vitest';
import { runAudit } from './audit';
import * as sources from './sources';

describe('audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResolvedValues = () => {
    vi.spyOn(sources, 'fetchRegistration').mockResolvedValue({
      found: false,
    } as any);
    vi.spyOn(sources, 'fetchContent').mockResolvedValue({
      redirects: [],
      headings: [],
      links: [],
      robots: { sitemaps: [] },
      technologies: [],
      sitemap: { found: false },
    } as any);
    vi.spyOn(sources, 'fetchPageSpeed').mockResolvedValue({
      scores: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 90,
      },
    } as any);
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
