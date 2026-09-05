import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, {
  normalizeTarget,
  isInternalHost,
  fetchWithTimeout,
  checkHttpsUpgrade,
  auditRobotsAndSitemap,
  allowedOrigins,
  rateLimitCache,
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

  describe('allowedOrigins', () => {
    it('returns DEFAULT_ORIGINS if env.ALLOWED_ORIGINS is not set', () => {
      expect(allowedOrigins({})).toEqual([
        'https://servicos.pedrosatin.com',
        'https://pedrosatin.com',
        'http://localhost:5173',
        'http://localhost:4173',
      ]);
    });
    it('returns DEFAULT_ORIGINS if env.ALLOWED_ORIGINS is empty or whitespace', () => {
      const expected = [
        'https://servicos.pedrosatin.com',
        'https://pedrosatin.com',
        'http://localhost:5173',
        'http://localhost:4173',
      ];
      expect(allowedOrigins({ ALLOWED_ORIGINS: '' })).toEqual(expected);
      expect(allowedOrigins({ ALLOWED_ORIGINS: '   ' })).toEqual(expected);
    });
    it('returns DEFAULT_ORIGINS if env.ALLOWED_ORIGINS contains only a wildcard', () => {
      expect(allowedOrigins({ ALLOWED_ORIGINS: '*' })).toEqual([
        'https://servicos.pedrosatin.com',
        'https://pedrosatin.com',
        'http://localhost:5173',
        'http://localhost:4173',
      ]);
    });
    it('returns DEFAULT_ORIGINS if env.ALLOWED_ORIGINS contains a wildcard among origins', () => {
      expect(allowedOrigins({ ALLOWED_ORIGINS: 'http://example.com, *' })).toEqual([
        'https://servicos.pedrosatin.com',
        'https://pedrosatin.com',
        'http://localhost:5173',
        'http://localhost:4173',
      ]);
    });
    it('returns parsed origins if env.ALLOWED_ORIGINS is valid', () => {
      expect(allowedOrigins({ ALLOWED_ORIGINS: 'http://example.com, https://example.org ' })).toEqual([
        'http://example.com',
        'https://example.org',
      ]);
    });
  });
});

describe('worker default handler', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('handles standard Error in runAudit (e.g. Network failure)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const request = new Request('http://localhost/audit?url=example.com', {
      headers: { origin: 'http://localhost:5173' }
    });

    const response = await worker.fetch(request, {});
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: false,
      error: 'Network failure',
      input: 'example.com'
    });
  });

  it('handles AbortError in runAudit', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const request = new Request('http://localhost/audit?url=example.com', {
      headers: { origin: 'http://localhost:5173' }
    });

    const response = await worker.fetch(request, {});
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: false,
      error: 'O site não respondeu dentro de 12 segundos.',
      input: 'example.com'
    });
  });

  it('handles unknown errors (non-Error types) in runAudit', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue('Some weird string error');

    const request = new Request('http://localhost/audit?url=example.com', {
      headers: { origin: 'http://localhost:5173' }
    });

    const response = await worker.fetch(request, {});
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: false,
      error: 'Falha desconhecida ao auditar o site.',
      input: 'example.com'
    });
  });
});


describe('Rate Limiting', () => {
  let env: Record<string, string>;

  beforeEach(() => {
    env = { ALLOWED_ORIGINS: 'https://servicos.pedrosatin.com' };
    rateLimitCache.clear();
  });

  const makeRequest = (ip: string) => {
    return new Request('https://servicos-api.pedrosatin.com/audit?url=exemplo.com.br', {
      headers: new Headers({
        origin: 'https://servicos.pedrosatin.com',
        'cf-connecting-ip': ip,
      }),
    });
  };

  it('allows requests within the limit', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '<html></html>',
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function() { return this; }
    });

    for (let i = 0; i < 10; i++) {
      const response = await worker.fetch(makeRequest('203.0.113.1'), env);
      // It might fail for other reasons if mocks aren't perfect, but we just check it doesn't return 429
      expect(response.status).not.toBe(429);
    }

    globalThis.fetch = originalFetch;
  });

  it('blocks requests exceeding the limit', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '<html></html>',
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function() { return this; }
    });

    // Make 10 requests that should pass the rate limit check
    for (let i = 0; i < 10; i++) {
      await worker.fetch(makeRequest('203.0.113.2'), env);
    }

    // The 11th request should be blocked
    const response = await worker.fetch(makeRequest('203.0.113.2'), env);
    expect(response.status).toBe(429);

    const data = (await response.json()) as { error: string };
    expect(data.error).toBe('Muitas requisições. Tente novamente mais tarde.');
    expect(response.headers.get('retry-after')).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it('allows requests from a different IP', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '<html></html>',
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function() { return this; }
    });

    // Make 10 requests from IP 1
    for (let i = 0; i < 10; i++) {
      await worker.fetch(makeRequest('203.0.113.3'), env);
    }

    // Request from IP 2 should still pass
    const response = await worker.fetch(makeRequest('203.0.113.4'), env);
    expect(response.status).not.toBe(429);

    globalThis.fetch = originalFetch;
  });
});
