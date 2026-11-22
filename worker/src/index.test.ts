import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import wranglerToml from '../wrangler.toml?raw';
import worker, {
  allowedHosts,
  allowedOrigins,
  auditRobotsAndSitemap,
  checkHttpsUpgrade,
  createAuditDns,
  fetchWithTimeout,
  isInternalHost,
  isSitemapHostAllowed,
  normalizeTarget,
  PAGESPEED_UPSTREAM_LIMITS,
  pageSpeedCache,
  pageSpeedUpstream,
  rateLimitCache,
  rateLimitClient,
  rateLimitPrefix,
  RATE_LIMIT_MAX_ENTRIES,
  RATE_LIMIT_PREFIX_SLOTS,
  readBodyLimited,
} from './index';

type DnsAnswer = { type: number; data: string };
type DnsTable = Record<string, DnsAnswer[] | Response>;

const PUBLIC_A: DnsAnswer[] = [{ type: 1, data: '93.184.216.34' }];

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
beforeEach(() => {
  rateLimitCache.clear();
  pageSpeedCache.clear();
  pageSpeedUpstream.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

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

  it('rejects internal IP and host sitemap candidates from robots.txt', async () => {
    const mock = installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('User-agent: *\nAllow: /\nSitemap: http://169.254.169.254/latest/meta-data/\nSitemap: http://10.0.0.1/sitemap.xml')
      : new Response('not found', { status: 404 }));
    const result = await auditRobotsAndSitemap('https://example.com');
    expect(result.sitemap).toMatchObject({ found: false, url: null, urlCount: null, isIndex: false });
    expect(result.sitemap.error).toMatch(/outro domínio/);
    expect(siteCalls(mock).filter((url) => /169\.254|10\.0\.0\.1/.test(url))).toEqual([]);
  });

  it('rejects sitemap candidates whose host resolves inside the network', async () => {
    const mock = installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('Sitemap: https://www.example.com/sitemap.xml')
      : new Response('not found', { status: 404 }), { 'www.example.com': [{ type: 1, data: '169.254.169.254' }] });
    const result = await auditRobotsAndSitemap('https://example.com');
    expect(result.sitemap.found).toBe(false);
    expect(result.sitemap.error).toBeUndefined();
    expect(siteCalls(mock).some((url) => url.includes('www.example.com'))).toBe(false);
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
      ? 'Sitemap: https://www.example.com/map.xml'
      : '<urlset><url><loc>https://example.com/</loc></url></urlset>'));
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap).toMatchObject({ found: true, url: 'https://www.example.com/map.xml', urlCount: 1 });
  });

  it('reports an inconclusive sitemap when every lookup fails instead of calling it missing', async () => {
    installFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('Sitemap: https://www.example.com/map.xml');
      throw new Error('Too many subrequests.');
    });
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap.found).toBe(false);
    expect(report.sitemap.error).toMatch(/sitemap/);
  });

  it('reports an inconclusive sitemap when DNS for the candidate host fails', async () => {
    installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('Sitemap: https://www.example.com/map.xml')
      : new Response('not found', { status: 404 }), { 'www.example.com': new Response('', { status: 503 }) });
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap.error).toBeDefined();
  });
});

describe('allowedOrigins', () => {
  const defaults = [
    'https://servicos.pedrosatin.com',
    'https://pedrosatin.com',
  ];

  it('keeps localhost out of the production defaults', () => {
    expect(allowedOrigins({}).some((origin) => origin.includes('localhost'))).toBe(false);
  });

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
  new Request(`https://servicos-api.pedrosatin.com/audit?${query}`, {
    headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': ip },
  });

const pagespeedRequest = (ip = '203.0.113.20') =>
  new Request('https://servicos-api.pedrosatin.com/pagespeed?domain=example.com&strategy=mobile', {
    headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': ip },
  });

describe('audit handler', () => {
  it('hides the message of unexpected errors and logs it instead', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    installFetch(() => { throw new Error('connect ECONNREFUSED 10.0.0.7:443'); });
    const body = await (await worker.fetch(auditRequest(), {})).json();
    expect(body).toEqual({
      ok: false,
      error: 'Não foi possível acessar o site. Confira o endereço e tente novamente.',
      input: 'example.com',
    });
    expect(logged).toHaveBeenCalled();
  });

  it('keeps the message of errors written for the client', async () => {
    installFetch((url) => new Response(null, { status: 302, headers: { location: `${url}x` } }));
    const body = await (await worker.fetch(auditRequest(), {})).json();
    expect(body).toEqual({ ok: false, error: 'Cadeia de redirecionamentos longa demais (possível laço).', input: 'example.com' });
  });

  it('answers errors, 404 and 405 with no-store', async () => {
    installFetch(() => new Response(''));
    const env = { ALLOWED_ORIGINS: 'https://allowed.example' };
    const make = (path: string, ip: string, method = 'GET') => new Request(`https://servicos-api.pedrosatin.com${path}`, {
      method, headers: { origin: 'https://allowed.example', 'cf-connecting-ip': ip },
    });
    const cases: [string, Response][] = [
      ['404 de rota', await worker.fetch(make('/unknown', 'ns-1'), env)],
      ['405', await worker.fetch(make('/audit?url=example.com', 'ns-2', 'POST'), env)],
      ['400 do /audit', await worker.fetch(make('/audit', 'ns-3'), env)],
      ['403 de origem', await worker.fetch(new Request('https://servicos-api.pedrosatin.com/audit?url=example.com', {
        headers: { origin: 'https://denied.example', 'cf-connecting-ip': 'ns-4' },
      }), env)],
    ];
    expect(cases.map(([, response]) => response.status)).toEqual([404, 405, 400, 403]);
    for (const [name, response] of cases) expect(response.headers.get('cache-control'), name).toBe('no-store');
  });

  it('answers a failed audit and a rate limit with no-store', async () => {
    installFetch(() => { throw new Error('boom'); });
    const failed = await worker.fetch(auditRequest('203.0.113.60'), {});
    expect(failed.status).toBe(200);
    expect(failed.headers.get('cache-control')).toBe('no-store');
    let limited = failed;
    for (let i = 0; i < 100 && limited.status !== 429; i++) limited = await worker.fetch(auditRequest('203.0.113.60'), {});
    expect(limited.status).toBe(429);
    expect(limited.headers.get('cache-control')).toBe('no-store');
  });

  it('answers an invalid domain with no-store', async () => {
    const response = await worker.fetch(auditRequest('203.0.113.62', 'url=localhost'), {});
    expect(response.status).toBe(200);
    expect(((await response.clone().json()) as { error?: string }).error).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps the cache of a successful audit', async () => {
    installFetch(() => new Response('<title>ok</title>', { headers: { 'content-type': 'text/html' } }));
    const response = await worker.fetch(auditRequest('203.0.113.61'), {});
    expect(((await response.clone().json()) as { ok?: boolean }).ok).not.toBe(false);
    expect(response.headers.get('cache-control')).toBe('public, max-age=120');
  });

  it('refuses localhost origins with the production configuration', async () => {
    installFetch(() => new Response(''));
    const request = new Request('https://servicos-api.pedrosatin.com/audit?url=example.com', {
      headers: { origin: 'http://localhost:5173', 'cf-connecting-ip': '203.0.113.40' },
    });
    expect((await worker.fetch(request, {})).status).toBe(403);
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
    const make = (path: string, origin?: string, ip?: string, method = 'GET') => new Request(`https://servicos-api.pedrosatin.com${path}`, { method, headers: { ...(origin ? { origin } : {}), ...(ip ? { 'cf-connecting-ip': ip } : {}) } });
    expect((await worker.fetch(make('/audit', undefined, undefined, 'OPTIONS'), env)).status).toBe(204);
    expect((await worker.fetch(make('/audit', 'https://allowed.example'), env)).status).toBe(403);
    expect((await worker.fetch(make('/audit', 'https://denied.example', 'one'), env)).status).toBe(403);
    expect((await worker.fetch(make('/unknown', 'https://allowed.example', 'two'), env)).status).toBe(404);
    expect((await worker.fetch(make('/audit', 'https://allowed.example', 'three'), env)).status).toBe(400);
  });
});

const tomlSection = (name: string): string => {
  if (name === '') return wranglerToml.split(/^\[/m)[0] ?? '';
  const escaped = name.replace(/[.[\]]/g, '\\$&');
  return new RegExp(`^\\[${escaped}\\]\\s*$([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, 'm').exec(wranglerToml)?.[1] ?? '';
};

const tomlValue = (section: string, key: string): string | undefined =>
  new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm').exec(tomlSection(section))?.[1]?.trim();

describe('allowedHosts', () => {
  it('falls back to the production domain when ALLOWED_HOSTS is missing, empty or a wildcard', () => {
    for (const value of [undefined, '', '   ', '*', 'localhost, *.workers.dev']) {
      expect(allowedHosts({ ALLOWED_HOSTS: value })).toEqual(['servicos-api.pedrosatin.com']);
    }
  });

  it('returns the parsed list in lower case', () => {
    expect(allowedHosts({ ALLOWED_HOSTS: ' Localhost, 127.0.0.1 ' })).toEqual(['localhost', '127.0.0.1']);
  });
});

describe('host allowlist', () => {
  const request = (base: string, ip: string) =>
    new Request(`${base}/pagespeed?domain=example.com&strategy=mobile`, {
      headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': ip },
    });

  const production = { ALLOWED_HOSTS: tomlValue('vars', 'ALLOWED_HOSTS') };
  const dev = { ALLOWED_HOSTS: tomlValue('env.dev.vars', 'ALLOWED_HOSTS') };

  it('turns off workers.dev and preview URLs in production and keeps localhost in dev only', () => {
    expect(tomlValue('', 'workers_dev')).toBe('false');
    expect(tomlValue('', 'preview_urls')).toBe('false');
    expect(production.ALLOWED_HOSTS).toBe('servicos-api.pedrosatin.com');
    expect(allowedHosts(dev)).toEqual(['localhost', '127.0.0.1']);
  });

  it('answers 404 to other hosts before the rate limit and any subrequest', async () => {
    const mock = installFetch(() => new Response('{}'));
    const hosts = ['https://pedrosatin-audit.example.workers.dev', 'https://attacker-chosen.invalid', 'http://localhost:8787'];
    for (const env of [production, {}]) {
      for (const [i, base] of hosts.entries()) {
        const response = await worker.fetch(request(base, `198.51.100.${i + 1}`), env);
        expect(response.status).toBe(404);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
      }
    }
    const preflight = new Request('https://pedrosatin-audit.example.workers.dev/audit', { method: 'OPTIONS' });
    expect((await worker.fetch(preflight, production)).status).toBe(404);
    expect(rateLimitCache.size).toBe(0);
    expect(mock).not.toHaveBeenCalled();
  });

  it('serves the production domain with the production configuration', async () => {
    const mock = installFetch(() => new Response('{}', { headers: { 'content-type': 'application/json' } }));
    const response = await worker.fetch(request('https://servicos-api.pedrosatin.com', '198.51.100.10'), production);
    expect(response.status).toBe(200);
    expect(rateLimitCache.size).toBe(1);
    expect(siteCalls(mock)).toHaveLength(1);
  });

  it('serves localhost with the dev configuration and refuses the other hosts', async () => {
    installFetch(() => new Response('{}', { headers: { 'content-type': 'application/json' } }));
    expect((await worker.fetch(request('http://localhost:8787', '127.0.0.1'), dev)).status).toBe(200);
    expect((await worker.fetch(request('http://127.0.0.1:8787', '127.0.0.2'), dev)).status).toBe(200);
    expect((await worker.fetch(request('https://pedrosatin-audit.example.workers.dev', '127.0.0.3'), dev)).status).toBe(404);
  });
});

describe('PageSpeed proxy', () => {
  it('logs only the status codes of a Google error, never its message', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errored = vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = 'Quota exceeded for example.com with key AIza-synthetic';
    installFetch(() => Response.json({
      error: { code: 429, status: 'RESOURCE_EXHAUSTED', message, errors: [{ reason: 'rateLimitExceeded', message }] },
    }, { status: 429 }));
    await worker.fetch(pagespeedRequest(), {});
    const logged = JSON.stringify([...warned.mock.calls, ...errored.mock.calls]);
    expect(warned).toHaveBeenCalledWith('pagespeed upstream error', 429, 'RESOURCE_EXHAUSTED', 'rateLimitExceeded');
    expect(logged).not.toContain('Quota exceeded');
    expect(logged).not.toContain('AIza-synthetic');
    expect(logged).not.toContain('example.com');
  });

  it('drops status and reason that are not structured codes', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installFetch(() => Response.json({
      error: { status: 'texto livre com espaços do Google', errors: [{ reason: 42 }] },
    }, { status: 500 }));
    await worker.fetch(pagespeedRequest(), {});
    expect(warned).toHaveBeenCalledWith('pagespeed upstream error', 500, undefined, undefined);
  });

  it('answers Google errors with no-store', async () => {
    installFetch(() => Response.json({ error: { code: 500 } }, { status: 500 }));
    expect((await worker.fetch(pagespeedRequest(), {})).headers.get('cache-control')).toBe('no-store');
  });

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

  it('answers a repeated measurement from the cache without calling Google again', async () => {
    const mock = installFetch(() => new Response('{"lighthouseResult":{}}', { headers: { 'content-type': 'application/json' } }));
    const first = await worker.fetch(pagespeedRequest('203.0.113.21'), {});
    const second = await worker.fetch(pagespeedRequest('203.0.113.22'), {});
    expect(await first.text()).toBe('{"lighthouseResult":{}}');
    expect(await second.text()).toBe('{"lighthouseResult":{}}');
    expect(second.headers.get('access-control-allow-origin')).toBe('https://servicos.pedrosatin.com');
    expect(mock.mock.calls.filter(([url]) => String(url).includes('pagespeedonline'))).toHaveLength(1);
    const desktop = new Request('https://servicos-api.pedrosatin.com/pagespeed?domain=example.com&strategy=desktop', {
      headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': '203.0.113.23' },
    });
    await worker.fetch(desktop, {});
    expect(mock.mock.calls.filter(([url]) => String(url).includes('pagespeedonline'))).toHaveLength(2);
  });

  it('does not cache Google errors', async () => {
    const mock = installFetch(() => Response.json({ error: { code: 500 } }, { status: 500 }));
    await worker.fetch(pagespeedRequest('203.0.113.24'), {});
    await worker.fetch(pagespeedRequest('203.0.113.25'), {});
    expect(mock.mock.calls.filter(([url]) => String(url).includes('pagespeedonline'))).toHaveLength(2);
  });

  it('rejects internal targets and unknown strategies', async () => {
    installFetch(() => new Response('{}'));
    const make = (query: string) => new Request(`https://servicos-api.pedrosatin.com/pagespeed?${query}`, {
      headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': '203.0.113.30' },
    });
    expect((await worker.fetch(make('domain=127.0.0.1'), {})).status).toBe(400);
    expect((await worker.fetch(make('domain=example.com&strategy=tablet'), {})).status).toBe(400);
  });
});

const googleCalls = (mock: ReturnType<typeof installFetch>) =>
  mock.mock.calls.filter(([url]) => String(url).includes('pagespeedonline')).length;

const pagespeedFor = (ip: string, domain: string) =>
  new Request(`https://servicos-api.pedrosatin.com/pagespeed?${new URLSearchParams({ domain, strategy: 'mobile' })}`, {
    headers: { origin: 'https://servicos.pedrosatin.com', 'cf-connecting-ip': ip },
  });

const tally = async (responses: Response[]) => {
  const counts: Record<number, number> = {};
  for (const response of responses) counts[response.status] = (counts[response.status] ?? 0) + 1;
  return counts;
};

describe('PageSpeed upstream caps', () => {
  const { perBlockPerMinute, perIsolatePerMinute } = PAGESPEED_UPSTREAM_LIMITS;
  const installPsi = () => installFetch(() => new Response('{"lighthouseResult":{}}', { headers: { 'content-type': 'application/json' } }));

  it('keeps 32 /64s of one /56 within one upstream budget', async () => {
    const mock = installPsi();
    const responses: Response[] = [];
    for (let k = 0; k < 32; k++) {
      const ip = `2001:db8:aa:${(0x100 + k).toString(16)}::1`;
      for (let i = 0; i < 31; i++) responses.push(await worker.fetch(pagespeedFor(ip, `example.com/?n=${k}-${i}`), {}));
    }
    expect(googleCalls(mock)).toBe(perBlockPerMinute);
    expect(googleCalls(mock)).toBeLessThanOrEqual(perIsolatePerMinute);
    expect(await tally(responses)).toEqual({ 200: perBlockPerMinute, 429: 32 * 31 - perBlockPerMinute });
  });

  it('answers an exhausted cap exactly like the Google quota error, without calling Google', async () => {
    const quota = installFetch(() => Response.json({ error: { code: 429, message: 'Quota exceeded' } }, { status: 429 }));
    const fromGoogle = await worker.fetch(pagespeedFor('203.0.113.60', 'google-quota.example.com'), {});
    expect(googleCalls(quota)).toBe(1);
    pageSpeedUpstream.clear();

    const mock = installPsi();
    for (let i = 0; i < perBlockPerMinute; i++) await worker.fetch(pagespeedFor(`203.0.113.${i + 1}`, `s${i}.example.com`), {});
    const capped = await worker.fetch(pagespeedFor('203.0.113.99', 'other.example.com'), {});
    expect(googleCalls(mock)).toBe(perBlockPerMinute);
    expect(capped.status).toBe(fromGoogle.status);
    expect(await capped.json()).toEqual(await fromGoogle.json());
    expect(capped.headers.get('access-control-allow-origin')).toBe('https://servicos.pedrosatin.com');
    expect(capped.headers.get('retry-after')).toBeNull();
  });

  it('gives each block its own budget while the isolate cap has room', async () => {
    const mock = installPsi();
    for (let i = 0; i < perBlockPerMinute + 1; i++) await worker.fetch(pagespeedFor(`203.0.113.${i + 1}`, `a${i}.example.com`), {});
    expect(googleCalls(mock)).toBe(perBlockPerMinute);
    expect((await worker.fetch(pagespeedFor('198.51.100.1', 'b.example.com'), {})).status).toBe(200);
    expect((await worker.fetch(pagespeedFor('2001:db8:cc:1::1', 'c.example.com'), {})).status).toBe(200);
    expect(googleCalls(mock)).toBe(perBlockPerMinute + 2);
  });

  it('caps the whole isolate across blocks', async () => {
    const mock = installPsi();
    const blocks = Math.ceil(perIsolatePerMinute / perBlockPerMinute) + 1;
    for (let b = 0; b < blocks; b++) {
      for (let i = 0; i < perBlockPerMinute; i++) {
        await worker.fetch(pagespeedFor(`2001:db8:${(0x100 + b).toString(16)}:${i.toString(16)}::1`, `b${b}-${i}.example.com`), {});
      }
    }
    expect(googleCalls(mock)).toBe(perIsolatePerMinute);
  });

  it('does not spend any cap on cache hits', async () => {
    const mock = installPsi();
    await worker.fetch(pagespeedFor('203.0.113.1', 'example.com'), {});
    for (let i = 0; i < 29; i++) expect((await worker.fetch(pagespeedFor('203.0.113.1', 'example.com'), {})).status).toBe(200);
    for (let i = 0; i < 40; i++) expect((await worker.fetch(pagespeedFor(`198.51.${i}.1`, 'example.com'), {})).status).toBe(200);
    expect(googleCalls(mock)).toBe(1);
    const block = await Promise.all(Array.from({ length: perBlockPerMinute }, (_, i) =>
      worker.fetch(pagespeedFor('203.0.113.2', `a${i}.example.com`), {})));
    expect(await tally(block)).toEqual({ 200: perBlockPerMinute - 1, 429: 1 });
    const remaining = perIsolatePerMinute - perBlockPerMinute;
    for (let i = 0; i < remaining; i++) {
      expect((await worker.fetch(pagespeedFor(`2001:db8:dd:${i.toString(16)}::1`, `d${i}.example.com`), {})).status).toBe(200);
    }
    expect(googleCalls(mock)).toBe(perIsolatePerMinute);
    expect((await worker.fetch(pagespeedFor('192.0.2.1', 'new.example.com'), {})).status).toBe(429);
    expect((await worker.fetch(pagespeedFor('192.0.2.1', 'example.com'), {})).status).toBe(200);
    expect(googleCalls(mock)).toBe(perIsolatePerMinute);
  });

  it('renews the block budget in the next minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const mock = installPsi();
      for (let i = 0; i < perBlockPerMinute + 1; i++) await worker.fetch(pagespeedFor(`203.0.113.${i + 1}`, `a${i}.example.com`), {});
      expect(googleCalls(mock)).toBe(perBlockPerMinute);
      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
      expect((await worker.fetch(pagespeedFor('203.0.113.200', 'next.example.com'), {})).status).toBe(200);
      expect(googleCalls(mock)).toBe(perBlockPerMinute + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pageSpeedUpstream', () => {
  const { perBlockPerMinute, perIsolatePerMinute, perIsolatePerHour } = PAGESPEED_UPSTREAM_LIMITS;
  const start = Date.parse('2026-01-01T00:00:00Z');
  const spend = (count: number, now: number, block = (i: number) => `block-${now}-${i}`) => {
    for (let i = 0; i < count; i++) expect(pageSpeedUpstream.reserve(block(i), now)).toBeNull();
  };

  it('keeps the upstream caps inside the effective Google quota', () => {
    expect(perIsolatePerMinute * 4).toBeLessThanOrEqual(24);
    expect(perBlockPerMinute).toBeLessThan(perIsolatePerMinute);
    expect(perIsolatePerHour * 4 * 24).toBeLessThan(25_000);
  });

  it('names the exhausted cap and does not count a refused call', () => {
    spend(perBlockPerMinute, start, () => 'a');
    expect(pageSpeedUpstream.reserve('a', start)).toBe('bloco');
    expect(pageSpeedUpstream.reserve('a', start)).toBe('bloco');
    spend(perIsolatePerMinute - perBlockPerMinute, start);
    expect(pageSpeedUpstream.reserve('b', start)).toBe('minuto');
  });

  it('renews the minute cap and keeps the hourly cap across minutes', () => {
    let now = start;
    let spent = 0;
    while (spent + perIsolatePerMinute <= perIsolatePerHour) {
      spend(perIsolatePerMinute, now);
      expect(pageSpeedUpstream.reserve('x', now)).toBe('minuto');
      spent += perIsolatePerMinute;
      now += 60_000;
    }
    spend(perIsolatePerHour - spent, now);
    expect(pageSpeedUpstream.reserve('y', now)).toBe('hora');
    expect(pageSpeedUpstream.reserve('y', start + 60 * 60_000 - 1)).toBe('hora');
    expect(pageSpeedUpstream.reserve('y', start + 60 * 60_000)).toBeNull();
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

  it('sends clients above the prefix slot limit to a counter of their own /24', async () => {
    for (let i = 0; i < RATE_LIMIT_PREFIX_SLOTS; i++) {
      expect((await worker.fetch(auditRequest(`203.0.113.${i + 1}`), {})).status).not.toBe(429);
    }
    expect(rateLimitCache.prefixSlots.get('audit:203.0.113.0/24')).toBe(RATE_LIMIT_PREFIX_SLOTS);
    for (let i = 0; i < 10; i++) {
      expect((await worker.fetch(auditRequest(`203.0.113.${100 + i}`), {})).status).not.toBe(429);
    }
    expect((await worker.fetch(auditRequest('203.0.113.200'), {})).status).toBe(429);
    expect(rateLimitCache.get('audit:203.0.113.0/24')?.count).toBe(10);
    expect(rateLimitCache.has('audit:203.0.113.100')).toBe(false);
    expect((await worker.fetch(auditRequest('203.0.113.1'), {})).status).not.toBe(429);
    expect((await worker.fetch(auditRequest('203.0.114.1'), {})).status).not.toBe(429);
    installFetch(() => Response.json({ lighthouseResult: { categories: {} } }));
    expect((await worker.fetch(pagespeedRequest('203.0.113.201'), {})).status).toBe(200);
  });

  it('groups IPv6 /64s of the same /48 into one prefix counter above the slot limit', async () => {
    for (let i = 0; i < RATE_LIMIT_PREFIX_SLOTS + 10; i++) {
      expect((await worker.fetch(auditRequest(`2001:db8:aaaa:${i.toString(16)}::1`), {})).status).not.toBe(429);
    }
    expect((await worker.fetch(auditRequest('2001:db8:aaaa:ffff::1'), {})).status).toBe(429);
    expect(rateLimitCache.get('audit:2001:db8:aaaa::/48')?.count).toBe(10);
    expect((await worker.fetch(auditRequest('2001:db8:aaab:1::1'), {})).status).not.toBe(429);
  });

  it('keeps one /48 from locking out new visitors after 5000 unique requests', async () => {
    const noOrigin = (ip: string) =>
      new Request('https://servicos-api.pedrosatin.com/audit?url=x', { headers: { 'cf-connecting-ip': ip } });
    const preAttack = await worker.fetch(auditRequest('203.0.113.7'), {});
    expect(preAttack.status).toBe(200);
    for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES + 10; i++) {
      const ip = `2001:db8:bbbb:${i.toString(16)}::1`;
      await worker.fetch(i % 2 === 0 ? noOrigin(ip) : auditRequest(ip), {});
    }
    expect(rateLimitCache.size).toBeLessThanOrEqual(RATE_LIMIT_PREFIX_SLOTS + 2);
    expect(rateLimitCache.get('audit:2001:db8:bbbb::/48')?.count).toBe(10);
    const visitor = await worker.fetch(auditRequest('198.51.100.1'), {});
    expect(visitor.status).toBe(200);
    expect((await worker.fetch(auditRequest('203.0.113.7'), {})).status).toBe(200);
  });

  it('keeps the table under its memory limit when many prefixes fill it', async () => {
    const expiresAt = Date.now() + 60_000;
    rateLimitCache.set('audit:198.51.100.9', { count: 10, expiresAt });
    const total = RATE_LIMIT_MAX_ENTRIES + 3 * RATE_LIMIT_PREFIX_SLOTS;
    for (let i = 0; i < total; i++) {
      const ip = `2001:db8:${Math.floor(i / RATE_LIMIT_PREFIX_SLOTS).toString(16)}:${(i % RATE_LIMIT_PREFIX_SLOTS).toString(16)}::1`;
      await worker.fetch(new Request('https://servicos-api.pedrosatin.com/audit?url=x', { headers: { 'cf-connecting-ip': ip } }), {});
      expect(rateLimitCache.size).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES);
    }
    expect(rateLimitCache.size).toBe(RATE_LIMIT_MAX_ENTRIES);
    expect((await worker.fetch(auditRequest('203.0.113.50'), {})).status).toBe(200);
    expect((await worker.fetch(auditRequest('203.0.113.51'), {})).status).toBe(200);
    expect(rateLimitCache.get('audit:203.0.113.0/24')?.count).toBe(2);
    expect(rateLimitCache.has('audit:203.0.113.50')).toBe(false);
    expect(rateLimitCache.size).toBe(RATE_LIMIT_MAX_ENTRIES);
    const slots = [...rateLimitCache.prefixSlots.values()].reduce((sum, n) => sum + n, 0);
    const clientWindows = [...rateLimitCache.values()].filter((record) => record.prefixKey).length;
    expect(slots).toBe(clientWindows);
  });

  it('frees expired windows before falling back to the prefix counter', async () => {
    const expired = Date.now() - 1;
    for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES; i++) rateLimitCache.set(`audit:old-${i}`, { count: 10, expiresAt: expired });
    await worker.fetch(auditRequest('203.0.113.8'), {});
    expect(rateLimitCache.has('audit:203.0.113.8')).toBe(true);
    expect(rateLimitCache.has('audit:203.0.113.0/24')).toBe(false);
    expect(rateLimitCache.size).toBe(1);
  });

  it('counts IPv6 clients by /64 prefix', async () => {
    for (let i = 0; i < 10; i++) await worker.fetch(auditRequest(`2001:db8:1:2::${i + 1}`), {});
    expect((await worker.fetch(auditRequest('2001:db8:1:2:ffff::1'), {})).status).toBe(429);
    expect((await worker.fetch(auditRequest('2001:db8:1:3::1'), {})).status).not.toBe(429);
  });

  it('drops expired windows before counting', async () => {
    rateLimitCache.set('audit:old', { count: 10, expiresAt: Date.now() - 1 });
    await worker.fetch(auditRequest('203.0.113.7'), {});
    expect(rateLimitCache.has('audit:old')).toBe(false);
  });
});

describe('rateLimitClient', () => {
  it('groups IPv6 by /64 and keeps IPv4 as is', () => {
    expect(rateLimitClient('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd:12::/64');
    expect(rateLimitClient('2001:DB8:ABCD:12::99')).toBe('2001:db8:abcd:12::/64');
    expect(rateLimitClient('203.0.113.9')).toBe('203.0.113.9');
    expect(rateLimitClient('::ffff:203.0.113.9')).toBe('203.0.113.9');
  });
});

describe('rateLimitPrefix', () => {
  it('groups /64 clients by /48 and IPv4 clients by /24', () => {
    expect(rateLimitPrefix('2001:db8:abcd:12::/64')).toBe('2001:db8:abcd::/48');
    expect(rateLimitPrefix(rateLimitClient('2001:db8:0:ffff::1'))).toBe('2001:db8:0::/48');
    expect(rateLimitPrefix('203.0.113.9')).toBe('203.0.113.0/24');
    expect(rateLimitPrefix(rateLimitClient('::ffff:203.0.113.9'))).toBe('203.0.113.0/24');
    expect(rateLimitPrefix('local')).toBe('local');
  });
});

describe('sitemap scope', () => {
  it('accepts only the site host and its www variant', () => {
    expect(isSitemapHostAllowed('example.com', 'example.com')).toBe(true);
    expect(isSitemapHostAllowed('www.example.com', 'example.com')).toBe(true);
    expect(isSitemapHostAllowed('example.com', 'www.example.com')).toBe(true);
    expect(isSitemapHostAllowed('WWW.Example.com.', 'example.com')).toBe(true);
    expect(isSitemapHostAllowed('cdn.example.com', 'example.com')).toBe(false);
    expect(isSitemapHostAllowed('victim.github.io', 'attacker.github.io')).toBe(false);
    expect(isSitemapHostAllowed('other.pages.dev', 'evil.pages.dev')).toBe(false);
    expect(isSitemapHostAllowed('pages.dev', 'www.pages.dev')).toBe(true);
    expect(isSitemapHostAllowed('1.2.3.4', '1.2.3.4')).toBe(true);
    expect(isSitemapHostAllowed('9.2.3.4', '1.2.3.4')).toBe(false);
    expect(isSitemapHostAllowed('www.1.2.3.4', '1.2.3.4')).toBe(false);
  });

  it('does not fetch sitemaps from other hosts and reports them as unverified', async () => {
    const mock = installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('Sitemap: https://victim.example.org/sitemap.xml\nSitemap: https://cdn.example.com/map.xml')
      : new Response('not found', { status: 404 }));
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap.found).toBe(false);
    expect(report.sitemap.error).toMatch(/outro domínio/);
    expect(siteCalls(mock).some((url) => /victim\.example\.org|cdn\.example\.com/.test(url))).toBe(false);
  });

  it('still prefers an in-scope sitemap when another one is out of scope', async () => {
    installFetch((url) => url.endsWith('/robots.txt')
      ? new Response('Sitemap: https://victim.example.org/sitemap.xml\nSitemap: https://www.example.com/map.xml')
      : new Response('<urlset><url><loc>https://example.com/</loc></url></urlset>'));
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap).toMatchObject({ found: true, url: 'https://www.example.com/map.xml' });
  });

  it('does not follow a sitemap redirect to another host', async () => {
    const mock = installFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('Sitemap: https://example.com/map.xml');
      if (url.endsWith('/map.xml')) return new Response(null, { status: 302, headers: { location: 'https://victim.example.org/x' } });
      return new Response('not found', { status: 404 });
    });
    const report = await auditRobotsAndSitemap('https://example.com');
    expect(report.sitemap.found).toBe(false);
    expect(report.sitemap.error).toBeDefined();
    expect(siteCalls(mock).some((url) => url.includes('victim.example.org'))).toBe(false);
  });
});

describe('subrequest budget', () => {
  it('reports the sitemap as unverified when the budget runs out', async () => {
    const mock = installFetch((url) => {
      if (url.endsWith('/robots.txt')) return new Response('Sitemap: https://example.com/a.xml\nSitemap: https://www.example.com/b.xml');
      return new Response(null, { status: 302, headers: { location: `${url}x` } });
    });
    const report = await auditRobotsAndSitemap('https://example.com', createAuditDns(6));
    expect(report.sitemap.found).toBe(false);
    expect(report.sitemap.error).toMatch(/limite de \d+ requisições/);
    expect(mock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('fails the audit with an explicit message when the page itself exceeds the budget', async () => {
    let hop = 0;
    installFetch(() => {
      hop += 1;
      return new Response(null, { status: 302, headers: { location: `https://h${hop}.example.com/` } });
    });
    await expect(
      (async () => {
        const dns = createAuditDns(5);
        await fetchWithTimeout('https://example.com/', { dns });
        await fetchWithTimeout('https://h1.example.com/', { dns });
      })(),
    ).rejects.toThrow(/limite de 5 requisições/);
  });
});
