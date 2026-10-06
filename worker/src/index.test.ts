import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { normalizeTarget, isInternalHost, readBodyLimited, auditRobotsAndSitemap, rateLimitCache, fetchWithTimeout } from './index';

const dns = () => Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] });
const installFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    return url.includes('cloudflare-dns.com/') ? dns() : handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
};
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => rateLimitCache.clear());

describe('public HTTP targets', () => {
  it('rejects private addresses and encoded variants', async () => {
    installFetch(() => new Response(''));
    for (const host of ['localhost', '2130706433', '0x7f000001', '::ffff:7f00:1', '192.168.1.1', '169.254.169.254']) {
      expect(await isInternalHost(host)).toBe(true);
    }
  });
  it('fails closed on DNS outage, NXDOMAIN and no addresses', async () => {
    for (const result of [new Response('', { status: 503 }), Response.json({ Status: 3 }), Response.json({ Status: 0 })]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(result));
      expect(await normalizeTarget('example.com')).toBeNull();
    }
  });
  it('accepts ordinary public domains and rejects credentials and custom ports', async () => {
    installFetch(() => new Response(''));
    expect((await normalizeTarget('example.com/path'))?.href).toBe('https://example.com/path');
    expect(await normalizeTarget('https://user:password@example.com')).toBeNull();
    expect(await normalizeTarget('https://example.com:8080')).toBeNull();
  });
  it('forces manual redirects and ignores caller hostname/header overrides', async () => {
    const mock = installFetch(() => new Response('ok'));
    const response = await fetchWithTimeout('https://example.com', { headers: { host: 'localhost' }, redirect: 'follow' });
    await readBodyLimited(response);
    expect(mock.mock.calls.at(-1)?.[1]).toMatchObject({ redirect: 'manual', method: 'GET' });
    expect(new Headers(mock.mock.calls.at(-1)?.[1]?.headers).get('host')).toBeNull();
  });
});

describe('bounded HTTP bodies and secondary requests', () => {
  it('cancels a body when the byte ceiling is reached', async () => {
    const cancelled = vi.fn();
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(100)); }, cancel: cancelled });
    expect((await readBodyLimited(new Response(stream), 16)).bytes).toBe(16);
    expect(cancelled).toHaveBeenCalled();
  });
  it('cancels a body that stalls after headers', async () => {
    const cancelled = vi.fn();
    const response = new Response(new ReadableStream({ cancel: cancelled }));
    await expect(readBodyLimited(response, 16, 20)).rejects.toThrow();
    expect(cancelled).toHaveBeenCalled();
  });
  it('blocks redirects to metadata from robots and sitemap before fetch', async () => {
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const mock = installFetch((url) => url.endsWith(path)
        ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
        : new Response('User-agent: *'));
      await auditRobotsAndSitemap('https://example.com');
      expect(mock.mock.calls.some(([url]) => String(url).includes('169.254.169.254'))).toBe(false);
    }
  });
  it('retains legitimate cross-domain public sitemaps', async () => {
    installFetch((url) => new Response(url.endsWith('/robots.txt')
      ? 'Sitemap: https://cdn.example.com/map.xml'
      : '<urlset><url><loc>https://example.com/</loc></url></urlset>'));
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap).toMatchObject({ found: true, url: 'https://cdn.example.com/map.xml', urlCount: 1 });
  });
});

it('shares the request quota with the PageSpeed proxy and keeps its key server-side', async () => {
  const mock = installFetch(() => Response.json({ lighthouseResult: { categories: {} } }));
  const request = () => new Request('https://api.example.com/pagespeed?domain=example.com&strategy=mobile', {
    headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': '203.0.113.1' },
  });
  const response = await worker.fetch(request(), { PSI_KEY: 'synthetic-test-secret' });
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain('synthetic-test-secret');
  expect(mock.mock.calls.some(([url]) => String(url).includes('key=synthetic-test-secret'))).toBe(true);
  for (let i = 1; i < 10; i++) await worker.fetch(request(), {});
  expect((await worker.fetch(request(), {})).status).toBe(429);
});

 it('preserves preflight and refuses missing identity, unauthorized origins and invalid routes', async () => {
  installFetch(() => new Response(''));
  const env = { ALLOWED_ORIGINS: 'https://allowed.example' };
  const make = (path: string, origin?: string, ip?: string, method = 'GET') => new Request(`https://api.example${path}`, { method, headers: { ...(origin ? { origin } : {}), ...(ip ? { 'cf-connecting-ip': ip } : {}) } });
  expect((await worker.fetch(make('/audit', undefined, undefined, 'OPTIONS'), env)).status).toBe(204);
  expect((await worker.fetch(make('/audit', 'https://allowed.example'), env)).status).toBe(403);
  expect((await worker.fetch(make('/audit', 'https://denied.example', 'one'), env)).status).toBe(403);
  expect((await worker.fetch(make('/unknown', 'https://allowed.example', 'two'), env)).status).toBe(404);
  expect((await worker.fetch(make('/audit', 'https://allowed.example', 'three'), env)).status).toBe(400);
});
