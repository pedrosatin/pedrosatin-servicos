import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeTarget,
  isInternalHost,
  fetchWithTimeout,
  checkHttpsUpgrade,
  auditRobotsAndSitemap,
} from './index';

describe('worker index helpers', () => {
  describe('isInternalHost', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('identifies localhost and local domain names', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await isInternalHost('localhost')).toBe(true);
      expect(await isInternalHost('test.localhost')).toBe(true);
      expect(await isInternalHost('server.local')).toBe(true);
      expect(await isInternalHost('service.internal')).toBe(true);
      expect(await isInternalHost('router.home.arpa')).toBe(true);
    });

    it('identifies private IPv4 addresses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await isInternalHost('127.0.0.1')).toBe(true);
      expect(await isInternalHost('10.0.0.1')).toBe(true);
      expect(await isInternalHost('192.168.1.1')).toBe(true);
      expect(await isInternalHost('172.16.0.1')).toBe(true);
      expect(await isInternalHost('169.254.1.1')).toBe(true);
    });

    it('identifies IPv4-mapped IPv6 addresses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await isInternalHost('::ffff:127.0.0.1')).toBe(true);
      expect(await isInternalHost('::ffff:7f00:1')).toBe(true);
      expect(await isInternalHost('::ffff:c0a8:101')).toBe(true);
      expect(await isInternalHost('::1')).toBe(true);
    });

    it('allows public hosts', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await isInternalHost('example.com')).toBe(false);
      expect(await isInternalHost('google.com')).toBe(false);
      expect(await isInternalHost('8.8.8.8')).toBe(false);
    });
  });

  describe('normalizeTarget', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns valid URLs unchanged if they have a supported protocol', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect((await normalizeTarget('https://example.com'))?.href).toBe('https://example.com/');
      expect((await normalizeTarget('http://example.com'))?.href).toBe('http://example.com/');
      expect((await normalizeTarget('https://example.com/path'))?.href).toBe('https://example.com/path');
    });

    it('adds https:// if no protocol is provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect((await normalizeTarget('example.com'))?.href).toBe('https://example.com/');
      expect((await normalizeTarget('www.example.com/path'))?.href).toBe('https://www.example.com/path');
    });

    it('returns null for empty strings or invalid inputs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await normalizeTarget('')).toBeNull();
      expect(await normalizeTarget('   ')).toBeNull();
      expect(await normalizeTarget('ftp://example.com')).toBeNull();
      expect(await normalizeTarget('localhost')).toBeNull();
      expect(await normalizeTarget('https://127.0.0.1')).toBeNull();
      expect(await normalizeTarget('https://%%%')).toBeNull();
    });
  });

  describe('fetchWithTimeout', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('clears timeout and returns response on success', async () => {
      const mockResponse = new Response('ok', { status: 200 });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const res = await fetchWithTimeout('https://example.com');

      expect(res).toBe(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('propagates fetch errors and clears timeout', async () => {
      const error = new Error('Network failure');
      globalThis.fetch = vi.fn().mockRejectedValue(error);
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      await expect(fetchWithTimeout('https://example.com')).rejects.toThrow('Network failure');
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkHttpsUpgrade', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should return null when fetch throws an error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await checkHttpsUpgrade('example.com');

      expect(result).toBeNull();
    });

    it('should return true when redirecting to https', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 301,
        headers: new Headers({ location: 'https://example.com/' }),
      } as unknown as Response);

      const result = await checkHttpsUpgrade('example.com');

      expect(result).toBe(true);
    });

    it('should return false when redirecting to http', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 301,
        headers: new Headers({ location: 'http://example.com/other' }),
      } as unknown as Response);

      const result = await checkHttpsUpgrade('example.com');

      expect(result).toBe(false);
    });

    it('should return false when there is no redirect', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
      } as unknown as Response);

      const result = await checkHttpsUpgrade('example.com');

      expect(result).toBe(false);
    });
  });

  describe('auditRobotsAndSitemap', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('handles sitemap fetch with fallback candidates', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      // robots.txt
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap1.xml\nSitemap: https://example.com/sitemap2.xml'),
        } as unknown as Response)
      );

      // sitemap1.xml fails
      fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      // sitemap2.xml succeeds
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://example.com/</loc></url></urlset>'),
        } as unknown as Response)
      );

      const result = await auditRobotsAndSitemap('https://example.com');

      expect(result.sitemap).toEqual({
        found: true,
        url: 'https://example.com/sitemap2.xml',
        urlCount: 1,
        isIndex: false,
      });
    });
  });
});
