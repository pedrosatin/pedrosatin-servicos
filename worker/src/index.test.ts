import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditRobotsAndSitemap } from './index';

// We need to mock global fetch since fetchWithTimeout uses it
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('auditRobotsAndSitemap', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should handle network error for robots.txt gracefully', async () => {
    // Setup fetch to throw for robots.txt and succeed with 404 for sitemap.xml
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('robots.txt')) {
        throw new TypeError('Failed to fetch');
      }
      if (url.includes('sitemap.xml')) {
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await auditRobotsAndSitemap('https://example.com');

    expect(result.robots).toBeNull();
    expect(result.sitemap.found).toBe(false);
  });

  it('should handle network error for sitemap.xml gracefully', async () => {
    // Setup fetch to succeed for robots.txt and throw for sitemap.xml
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('robots.txt')) {
        return new Response(null, { status: 404 });
      }
      if (url.includes('sitemap.xml')) {
        throw new TypeError('Failed to fetch sitemap');
      }
      return new Response(null, { status: 404 });
    });

    const result = await auditRobotsAndSitemap('https://example.com');

    expect(result.robots).toEqual({ found: false, blocksAll: false, sitemaps: [] });
    expect(result.sitemap.found).toBe(false);
  });

  it('should find sitemap and robots successfully', async () => {
    // Setup fetch to succeed for robots.txt and sitemap.xml
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('robots.txt')) {
        return new Response('User-agent: *\nAllow: /', { status: 200 });
      }
      if (url.includes('sitemap.xml')) {
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>', { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await auditRobotsAndSitemap('https://example.com');

    expect(result.robots).toEqual({ found: true, blocksAll: false, sitemaps: [] });
    expect(result.sitemap.found).toBe(true);
    expect(result.sitemap.urlCount).toBe(1);
  });

  it('should ignore false positive robots.txt that return html', async () => {
    // Setup fetch to succeed for robots.txt but with html content
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('robots.txt')) {
        return new Response('<!DOCTYPE html><html><head></head><body></body></html>', { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await auditRobotsAndSitemap('https://example.com');

    expect(result.robots).toEqual({ found: false, blocksAll: false, sitemaps: [] });
  });
});
