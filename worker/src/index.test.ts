import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditRobotsAndSitemap } from './index';

// Mock the global fetch function
global.fetch = vi.fn();

// Mock setTimeout and clearTimeout to avoid issues with fetchWithTimeout
vi.spyOn(global, 'setTimeout').mockImplementation(() => {
  return 123 as any; // return a dummy timer id
});
vi.spyOn(global, 'clearTimeout').mockImplementation(() => {});

describe('auditRobotsAndSitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles fetch errors correctly for sitemaps', async () => {
    const fetchMock = global.fetch as any;

    // First call (robots.txt) - Success
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml'),
      })
    );

    // Second call (sitemap.xml candidate 1) - Fail with network error
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

    // Third call (fallback sitemap.xml candidate 2) - Fail with timeout
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Timeout error')));

    const result = await auditRobotsAndSitemap('https://example.com');

    expect(result.robots).not.toBeNull();
    if (result.robots) {
      expect(result.robots.found).toBe(true);
      expect(result.robots.sitemaps).toContain('https://example.com/sitemap.xml');
    }

    // Sitemap should not be found due to errors
    expect(result.sitemap).toEqual({
      found: false,
      url: null,
      urlCount: null,
      isIndex: false,
    });

    // 1 call for robots.txt, 2 calls for candidates (since both fail, it tries the next one)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('handles success for second sitemap candidate after first fails', async () => {
    const fetchMock = global.fetch as any;

    // First call (robots.txt) - Success with 2 sitemaps
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Sitemap: https://example.com/sitemap1.xml\nSitemap: https://example.com/sitemap2.xml'),
      })
    );

    // Second call (sitemap1.xml) - Fail
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

    // Third call (sitemap2.xml) - Success
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://example.com/</loc></url></urlset>'),
      })
    );

    const result = await auditRobotsAndSitemap('https://example.com');

    // Sitemap should be found on the second candidate
    expect(result.sitemap).toEqual({
      found: true,
      url: 'https://example.com/sitemap2.xml',
      urlCount: 1,
      isIndex: false,
    });

    // 1 call for robots, 1 call for candidate 1, 1 call for candidate 2
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
