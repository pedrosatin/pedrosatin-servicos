import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, {
  allowedOrigins,
  auditRobotsAndSitemap,
  checkHttpsUpgrade,
  fetchWithTimeout,
  isInternalHost,
  normalizeTarget,
  rateLimitCache,
  RATE_LIMIT_MAX_ENTRIES,
  readBodyLimited,
} from './index';

type DnsAnswer = { type: number; data: string };
type DnsTable = Record<string, DnsAnswer[] | Response>;

const PUBLIC_A: DnsAnswer[] = [{ type: 1, data: '93.184.216.34' }];

/**
 * Simula o DoH e o restante da rede. Hosts fora de `table` resolvem para um
 * IPv4 público; um `Response` na tabela substitui a resposta do DoH inteira.
 */
const installFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  table: DnsTable = {},
) => {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('cloudflare-dns.com/')) {
      const name = new URL(url).searchParams.get('name') ?? '';
      const entry = table[name] ?? PUBLIC_A;
      return entry instanceof Response ? entry.clone() : Response.json({ Status: 0, Answer: entry });
    }
    return handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
};

const dohCalls = (mock: ReturnType<typeof installFetch>) =>
  mock.mock.calls.filter(([url]) => String(url).includes('cloudflare-dns.com/')).map(([url]) => {
    const params = new URL(String(url)).searchParams;
    return `${params.get('name')}/${params.get('type')}`;
  });

const siteCalls = (mock: ReturnType<typeof installFetch>) =>
  mock.mock.calls.map(([url]) => String(url)).filter((url) => !url.includes('cloudflare-dns.com/'));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => rateLimitCache.clear());

describe('isInternalHost', () => {
  beforeEach(() => { installFetch(() => new Response('')); });

  it('identifies localhost and internal name suffixes', async () => {
    for (const host of ['localhost', 'localhost.', 'test.localhost', 'server.local', 'service.internal', 'router.home.arpa']) {
      expect(await isInternalHost(host), host).toBe(true);
    }
  });

  it('identifies private and reserved IPv4 ranges', async () => {
    for (const host of [
      '0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
      '100.64.0.1', '100.127.255.254', '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.19.255.1',
      '198.51.100.1', '203.0.113.1', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255',
    ]) {
      expect(await isInternalHost(host), host).toBe(true);
    }
  });

  it('identifies decimal, hex and octal spellings of loopback', async () => {
    for (const host of ['2130706433', '0x7f000001', '0177.0.0.1']) {
      expect(await isInternalHost(host), host).toBe(true);
    }
  });

  it('identifies loopback, unspecified, local and multicast IPv6', async () => {
    for (const host of ['::1', '::', '[::1]', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1', '2001::1']) {
      expect(await isInternalHost(host), host).toBe(true);
    }
  });

  it('checks the IPv4 embedded in mapped, translated, NAT64 and 6to4 IPv6', async () => {
    for (const host of [
      '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:c0a8:101', '::ffff:0:7f00:1', '::ffff:0:10.0.0.1',
      '64:ff9b::a9fe:a9fe', '64:ff9b::10.0.0.1', '64:ff9b:1::1', '2002:7f00:1::1', '2002:a00:1::1',
    ]) {
      expect(await isInternalHost(host), host).toBe(true);
    }
    for (const host of ['::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1', '2606:4700:4700::1111']) {
      expect(await isInternalHost(host), host).toBe(false);
    }
  });

  it('allows public hosts and public IP literals', async () => {
    expect(await isInternalHost('example.com')).toBe(false);
    expect(await isInternalHost('8.8.8.8')).toBe(false);
    expect(await isInternalHost('100.128.0.1')).toBe(false);
  });

  it('blocks names whose DNS answers point inside the network', async () => {
    installFetch(() => new Response(''), {
      'looks-external.com': [{ type: 1, data: '192.168.1.1' }],
      'cgnat.example.com': [{ type: 1, data: '100.64.1.1' }],
      'nat64.example.com': [{ type: 28, data: '64:ff9b::a9fe:a9fe' }],
      'unspecified.example.com': [{ type: 28, data: '::' }],
      'garbage.example.com': [{ type: 1, data: 'not-an-ip' }],
    });
    for (const host of ['looks-external.com', 'cgnat.example.com', 'nat64.example.com', 'unspecified.example.com', 'garbage.example.com']) {
      expect(await isInternalHost(host), host).toBe(true);
    }
  });
});

describe('normalizeTarget', () => {
  beforeEach(() => { installFetch(() => new Response('')); });

  it('keeps supported URLs and adds https:// when the scheme is missing', async () => {
    expect((await normalizeTarget('https://example.com'))?.href).toBe('https://example.com/');
    expect((await normalizeTarget('http://example.com'))?.href).toBe('http://example.com/');
    expect((await normalizeTarget('example.com/path'))?.href).toBe('https://example.com/path');
    expect((await normalizeTarget('  www.example.com/path  '))?.href).toBe('https://www.example.com/path');
  });

  it('rejects empty, malformed, internal and dotless inputs', async () => {
    for (const input of ['', '   ', 'ftp://example.com', 'localhost', 'https://127.0.0.1', 'https://%%%',
      'https://javascript:alert(1)', 'https://internalhost', 'only-word', 'https://[::1]/']) {
      expect(await normalizeTarget(input), input).toBeNull();
    }
  });

  it('rejects credentials and custom ports', async () => {
    expect(await normalizeTarget('https://user:password@example.com')).toBeNull();
    expect(await normalizeTarget('https://example.com:8080')).toBeNull();
  });

  it('fails closed on DNS outage, NXDOMAIN and no addresses', async () => {
    for (const result of [new Response('', { status: 503 }), Response.json({ Status: 3 }), Response.json({ Status: 0 })]) {
      installFetch(() => new Response(''), { 'example.com': result });
      expect(await normalizeTarget('example.com')).toBeNull();
    }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    expect(await normalizeTarget('example.com')).toBeNull();
  });

  it('accepts a public A record when only the AAAA lookup fails', async () => {
    const servfail = Response.json({ Status: 2 });
    const mock = vi.fn(async (input: string | URL | Request) => {
      const params = new URL(String(input)).searchParams;
      return params.get('type') === 'AAAA' ? servfail.clone() : Response.json({ Status: 0, Answer: PUBLIC_A });
    });
    vi.stubGlobal('fetch', mock);
    expect((await normalizeTarget('example.com'))?.href).toBe('https://example.com/');
  });
});

describe('fetchWithTimeout', () => {
  it('forces a manual redirect GET with the audit headers', async () => {
    const mock = installFetch(() => new Response('ok'));
    const response = await fetchWithTimeout('https://example.com');
    await readBodyLimited(response);
    expect(mock.mock.calls.at(-1)?.[1]).toMatchObject({ redirect: 'manual', method: 'GET' });
    expect(new Headers(mock.mock.calls.at(-1)?.[1]?.headers).get('host')).toBeNull();
  });

  it('propagates network errors', async () => {
    installFetch(() => { throw new Error('Network failure'); });
    await expect(fetchWithTimeout('https://example.com')).rejects.toThrow('Network failure');
  });

  it('validates the target before fetching it', async () => {
    const mock = installFetch(() => new Response('ok'));
    await expect(fetchWithTimeout('http://169.254.169.254/latest/meta-data/')).rejects.toThrow();
    expect(siteCalls(mock)).toEqual([]);
  });
});

describe('checkHttpsUpgrade', () => {
  it('returns null when the request fails', async () => {
    installFetch(() => { throw new Error('Network failure'); });
    expect(await checkHttpsUpgrade('example.com')).toBeNull();
  });

  it('returns true when http:// redirects to https', async () => {
    installFetch(() => new Response(null, { status: 301, headers: { location: 'https://example.com/' } }));
    expect(await checkHttpsUpgrade('example.com')).toBe(true);
  });

  it('returns false when http:// redirects to another http address', async () => {
    installFetch(() => new Response(null, { status: 301, headers: { location: 'http://example.com/other' } }));
    expect(await checkHttpsUpgrade('example.com')).toBe(false);
  });

  it('returns false when there is no redirect', async () => {
    installFetch(() => new Response('ok'));
    expect(await checkHttpsUpgrade('example.com')).toBe(false);
  });
});

describe('bounded HTTP bodies', () => {
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
});

describe('auditRobotsAndSitemap', () => {
  it('blocks redirects to metadata from robots and sitemap before fetch', async () => {
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const mock = installFetch((url) => url.endsWith(path)
        ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
        : new Response('User-agent: *'));
      await auditRobotsAndSitemap('https://example.com');
      expect(siteCalls(mock).some((url) => url.includes('169.254.169.254'))).toBe(false);
    }
  });

  // Regressão do #191: sitemap declarado no robots.txt apontando para a rede interna.
  it('rejects internal IP and host sitemap candidates from robots.txt', async () => {
    const mock = installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('User-agent: *\nAllow: /\nSitemap: http://169.254.169.254/latest/meta-data/\nSitemap: http://10.0.0.1/sitemap.xml')
      : new Response('not found', { status: 404 }));
    const result = await auditRobotsAndSitemap('https://example.com');
    expect(result.sitemap).toEqual({ found: false, url: null, urlCount: null, isIndex: false });
    expect(siteCalls(mock).filter((url) => /169\.254|10\.0\.0\.1/.test(url))).toEqual([]);
  });

  it('rejects sitemap candidates whose host resolves inside the network', async () => {
    const mock = installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('Sitemap: https://metadata.example.net/sitemap.xml')
      : new Response('not found', { status: 404 }), { 'metadata.example.net': [{ type: 1, data: '169.254.169.254' }] });
    const result = await auditRobotsAndSitemap('https://example.com');
    expect(result.sitemap.found).toBe(false);
    expect(result.sitemap.error).toBeUndefined();
    expect(siteCalls(mock).some((url) => url.includes('metadata.example.net'))).toBe(false);
  });

  it('falls back in order when the first candidate fails', async () => {
    installFetch((url) => {
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap1.xml\nSitemap: https://example.com/sitemap2.xml');
      }
      if (url.endsWith('/sitemap1.xml')) throw new Error('Network error');
      return new Response('<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url></urlset>');
    });
    const result = await auditRobotsAndSitemap('https://example.com');
    expect(result.sitemap).toEqual({ found: true, url: 'https://example.com/sitemap2.xml', urlCount: 1, isIndex: false });
  });

  it('prefers a robots.txt sitemap over /sitemap.xml even when both answer', async () => {
    installFetch((url) => new Response(url.endsWith('/robots.txt')
      ? 'Sitemap: https://cdn.example.com/map.xml'
      : '<urlset><url><loc>https://example.com/</loc></url></urlset>'));
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap).toMatchObject({ found: true, url: 'https://cdn.example.com/map.xml', urlCount: 1 });
  });

  it('reports an inconclusive sitemap when every lookup fails instead of calling it missing', async () => {
    installFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('Sitemap: https://cdn.example.com/map.xml');
      throw new Error('Too many subrequests.');
    });
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap.found).toBe(false);
    expect(report.sitemap.error).toMatch(/sitemap/);
  });

  it('reports an inconclusive sitemap when DNS for the candidate host fails', async () => {
    installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('Sitemap: https://cdn.example.com/map.xml')
      : new Response('not found', { status: 404 }), { 'cdn.example.com': new Response('', { status: 503 }) });
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap.error).toBeDefined();
  });
});

describe('allowedOrigins', () => {
  const defaults = [
    'https://servicos.pedrosatin.com',
    'https://pedrosatin.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ];

  it('returns the defaults when ALLOWED_ORIGINS is not set', () => {
    expect(allowedOrigins({})).toEqual(defaults);
  });
  it('returns the defaults when ALLOWED_ORIGINS is empty or whitespace', () => {
    expect(allowedOrigins({ ALLOWED_ORIGINS: '' })).toEqual(defaults);
    expect(allowedOrigins({ ALLOWED_ORIGINS: '   ' })).toEqual(defaults);
  });
  it('returns the defaults when ALLOWED_ORIGINS is only a wildcard', () => {
    expect(allowedOrigins({ ALLOWED_ORIGINS: '*' })).toEqual(defaults);
  });
  it('returns the defaults when a wildcard is mixed with origins', () => {
    expect(allowedOrigins({ ALLOWED_ORIGINS: 'http://example.com, *' })).toEqual(defaults);
  });
  it('returns the parsed list when ALLOWED_ORIGINS is valid', () => {
    expect(allowedOrigins({ ALLOWED_ORIGINS: 'http://example.com, https://example.org ' })).toEqual([
      'http://example.com',
      'https://example.org',
    ]);
  });
});

const auditRequest = (ip = '203.0.113.10', query = 'url=example.com') =>
  new Request(`https://api.example.com/audit?${query}`, {
    headers: { origin: 'http://localhost:5173', 'cf-connecting-ip': ip },
  });

const pagespeedRequest = (ip = '203.0.113.20') =>
  new Request('https://api.example.com/pagespeed?domain=example.com&strategy=mobile', {
    headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': ip },
  });

describe('audit handler', () => {
  it('returns the message of an ordinary Error', async () => {
    installFetch(() => { throw new Error('Network failure'); });
    const body = await (await worker.fetch(auditRequest(), {})).json();
    expect(body).toEqual({ ok: false, error: 'Network failure', input: 'example.com' });
  });

  it('translates AbortError and TimeoutError to the timeout message', async () => {
    for (const name of ['AbortError', 'TimeoutError']) {
      installFetch(() => { throw new DOMException('The operation was aborted due to timeout', name); });
      const response = await worker.fetch(auditRequest(`198.51.0.${name.length}`), {});
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: false,
        error: 'O site não respondeu dentro de 12 segundos.',
        input: 'example.com',
      });
    }
  });

  it('uses a generic message for non-Error failures', async () => {
    installFetch(() => { throw 'Some weird string error'; });
    const body = await (await worker.fetch(auditRequest(), {})).json();
    expect(body).toEqual({ ok: false, error: 'Falha desconhecida ao auditar o site.', input: 'example.com' });
  });

  it('resolves each host once per audit', async () => {
    const mock = installFetch((url) => {
      if (url === 'https://example.com/') {
        return new Response(null, { status: 301, headers: { location: 'https://www.example.com/' } });
      }
      if (url.endsWith('/robots.txt')) return new Response('Sitemap: https://www.example.com/sitemap.xml');
      if (url.endsWith('/sitemap.xml')) return new Response('<urlset><url><loc>x</loc></url></urlset>');
      if (url.startsWith('http://')) return new Response(null, { status: 301, headers: { location: 'https://example.com/' } });
      return new Response('<html><title>ok</title></html>', { headers: { 'content-type': 'text/html' } });
    });
    const body = await (await worker.fetch(auditRequest(), {})).json() as { ok: boolean; sitemap: { found: boolean } };
    expect(body.ok).toBe(true);
    expect(body.sitemap.found).toBe(true);
    expect(dohCalls(mock).sort()).toEqual([
      'example.com/A', 'example.com/AAAA', 'www.example.com/A', 'www.example.com/AAAA',
    ]);
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
});

describe('PageSpeed proxy', () => {
  it('keeps the key server-side and forwards the body as received', async () => {
    const psiBody = '{"lighthouseResult":{"categories":{}},  "kept":"as-is"}';
    const mock = installFetch(() => new Response(psiBody, { headers: { 'content-type': 'application/json' } }));
    const response = await worker.fetch(pagespeedRequest(), { PSI_KEY: 'synthetic-test-secret' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const text = await response.text();
    expect(text).toBe(psiBody);
    expect(text).not.toContain('synthetic-test-secret');
    const google = mock.mock.calls.find(([url]) => String(url).includes('pagespeedonline'));
    expect(String(google?.[0])).not.toContain('synthetic-test-secret');
    const sent = new Headers(google?.[1]?.headers);
    expect(sent.get('x-goog-api-key')).toBe('synthetic-test-secret');
    expect(sent.get('referer')).toBe('https://servicos.pedrosatin.com/');
  });

  it('passes the Google status through without the provider body', async () => {
    installFetch(() => Response.json({ error: { code: 429, message: 'Quota exceeded' } }, { status: 429 }));
    const response = await worker.fetch(pagespeedRequest(), {});
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'PageSpeed indisponível.' });
  });

  it('answers 504 when Google times out', async () => {
    installFetch((url) => {
      if (url.includes('googleapis.com')) throw new DOMException('timeout', 'TimeoutError');
      return new Response('');
    });
    expect((await worker.fetch(pagespeedRequest(), {})).status).toBe(504);
  });

  it('rejects internal targets and unknown strategies', async () => {
    installFetch(() => new Response('{}'));
    const make = (query: string) => new Request(`https://api.example.com/pagespeed?${query}`, {
      headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': '203.0.113.30' },
    });
    expect((await worker.fetch(make('domain=127.0.0.1'), {})).status).toBe(400);
    expect((await worker.fetch(make('domain=example.com&strategy=tablet'), {})).status).toBe(400);
  });
});

describe('rate limiting', () => {
  beforeEach(() => { installFetch(() => new Response('<html></html>')); });

  it('allows ten audits per minute and blocks the eleventh with a marked 429', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await worker.fetch(auditRequest('203.0.113.2'), {})).status).not.toBe(429);
    }
    const response = await worker.fetch(auditRequest('203.0.113.2'), {});
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Muitas requisições. Tente novamente mais tarde.', code: 'rate_limited' });
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('allows requests from a different IP', async () => {
    for (let i = 0; i < 10; i++) await worker.fetch(auditRequest('203.0.113.3'), {});
    expect((await worker.fetch(auditRequest('203.0.113.4'), {})).status).not.toBe(429);
  });

  it('keeps a separate PageSpeed budget of 30 per minute', async () => {
    installFetch(() => Response.json({ lighthouseResult: { categories: {} } }));
    for (let i = 0; i < 10; i++) await worker.fetch(auditRequest('203.0.113.5'), {});
    for (let i = 0; i < 30; i++) {
      expect((await worker.fetch(pagespeedRequest('203.0.113.5'), {})).status).toBe(200);
    }
    const blocked = await worker.fetch(pagespeedRequest('203.0.113.5'), {});
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: 'rate_limited' });
  });

  it('evicts the oldest window instead of refusing new visitors when full', async () => {
    const expiresAt = Date.now() + 60_000;
    for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES; i++) rateLimitCache.set(`audit:filler-${i}`, { count: 1, expiresAt });
    expect((await worker.fetch(auditRequest('203.0.113.6'), {})).status).not.toBe(429);
    expect(rateLimitCache.size).toBe(RATE_LIMIT_MAX_ENTRIES);
    expect(rateLimitCache.has('audit:filler-0')).toBe(false);
    expect(rateLimitCache.has('audit:203.0.113.6')).toBe(true);
  });

  it('drops expired windows before counting', async () => {
    rateLimitCache.set('audit:old', { count: 10, expiresAt: Date.now() - 1 });
    await worker.fetch(auditRequest('203.0.113.7'), {});
    expect(rateLimitCache.has('audit:old')).toBe(false);
  });
});
