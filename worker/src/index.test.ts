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
    it('identifies localhost and local domain names', () => {
      expect(isInternalHost('localhost')).toBe(true);
      expect(isInternalHost('test.localhost')).toBe(true);
      expect(isInternalHost('server.local')).toBe(true);
      expect(isInternalHost('service.internal')).toBe(true);
      expect(isInternalHost('router.home.arpa')).toBe(true);
    });

    it('identifies private IPv4 addresses', () => {
      expect(isInternalHost('127.0.0.1')).toBe(true);
      expect(isInternalHost('10.0.0.1')).toBe(true);
      expect(isInternalHost('192.168.1.1')).toBe(true);
      expect(isInternalHost('172.16.0.1')).toBe(true);
      expect(isInternalHost('169.254.1.1')).toBe(true);
    });

    it('identifies IPv4-mapped IPv6 addresses', () => {
      expect(isInternalHost('::ffff:127.0.0.1')).toBe(true);
      expect(isInternalHost('::ffff:7f00:1')).toBe(true);
      expect(isInternalHost('::ffff:c0a8:101')).toBe(true);
      expect(isInternalHost('::1')).toBe(true);
    });

    it('allows public hosts', () => {
      expect(isInternalHost('example.com')).toBe(false);
      expect(isInternalHost('google.com')).toBe(false);
      expect(isInternalHost('8.8.8.8')).toBe(false);
    });
  });

  describe('normalizeTarget', () => {
    it('returns valid URLs unchanged if they have a supported protocol', () => {
      expect(normalizeTarget('https://example.com')?.href).toBe('https://example.com/');
      expect(normalizeTarget('http://example.com')?.href).toBe('http://example.com/');
      expect(normalizeTarget('https://example.com/path')?.href).toBe('https://example.com/path');
    });

    it('adds https:// if no protocol is provided', () => {
      expect(normalizeTarget('example.com')?.href).toBe('https://example.com/');
      expect(normalizeTarget('www.example.com/path')?.href).toBe('https://www.example.com/path');
    });

    it('returns null for empty strings or invalid inputs', () => {
      expect(normalizeTarget('')).toBeNull();
      expect(normalizeTarget('   ')).toBeNull();
      expect(normalizeTarget('ftp://example.com')).toBeNull();
      expect(normalizeTarget('localhost')).toBeNull();
      expect(normalizeTarget('https://127.0.0.1')).toBeNull();
      expect(normalizeTarget('https://%%%')).toBeNull();
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

describe('default fetch handler', () => {
    const originalFetch = globalThis.fetch;
    const mockEnv = { ALLOWED_ORIGINS: 'http://localhost:5173' };
    const mockRequest = (url: string, origin = 'http://localhost:5173') => {
      return new Request(url, {
        method: 'GET',
        headers: new Headers({ origin }),
      });
    };

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('returns 12 seconds error for AbortError', async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      globalThis.fetch = vi.fn().mockRejectedValue(error);

      // We need to import the default export, but since it's an ES module, we'll dynamic import
      const worker = (await import('./index')).default;
      const req = mockRequest('http://localhost/audit?url=example.com');
      const res = await worker.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        ok: false,
        error: 'O site não respondeu dentro de 12 segundos.',
        input: 'example.com',
      });
    });

    it('returns error message for standard Error', async () => {
      const error = new Error('O site redireciona para um endereço de rede interna.');
      globalThis.fetch = vi.fn().mockRejectedValue(error);

      const worker = (await import('./index')).default;
      const req = mockRequest('http://localhost/audit?url=example.com');
      const res = await worker.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        ok: false,
        error: 'O site redireciona para um endereço de rede interna.',
        input: 'example.com',
      });
    });

    it('returns fallback message for unknown errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue('just a string');

      const worker = (await import('./index')).default;
      const req = mockRequest('http://localhost/audit?url=example.com');
      const res = await worker.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        ok: false,
        error: 'Falha desconhecida ao auditar o site.',
        input: 'example.com',
      });
    });
  });
