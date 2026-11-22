
import { countSitemapUrls, isSitemapIndex, parseHtml, parseRobots } from './parse.ts';
import type { AuditResponse, RedirectHop, RobotsReport, SitemapReport } from '../../shared/report-types.ts';

interface Env {
  ALLOWED_HOSTS?: string;
  ALLOWED_ORIGINS?: string;
  PSI_KEY?: string;
}

const DEFAULT_ORIGINS = [
  'https://servicos.pedrosatin.com',
  'https://pedrosatin.com',
];

const DEFAULT_HOSTS = ['servicos-api.pedrosatin.com'];

const USER_AGENT =
  'Mozilla/5.0 (compatible; PedroSatinAudit/1.0; +https://servicos.pedrosatin.com)';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3_000_000;

export const MAX_SUBREQUESTS_PER_AUDIT = 40;

export class AuditError extends Error {}

export class BlockedTargetError extends AuditError {}

export class OutOfScopeError extends AuditError {}

export class SubrequestLimitError extends AuditError {}

export const allowedOrigins = (env: Env): string[] => {
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === '') return DEFAULT_ORIGINS;
  const origins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) return DEFAULT_ORIGINS;
  return origins;
};

export const allowedHosts = (env: Env): string[] => {
  const hosts = (env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (hosts.length === 0 || hosts.some((h) => h.includes('*'))) return DEFAULT_HOSTS;
  return hosts;
};

const corsHeaders = (origin: string | null, env: Env): Record<string, string> => {
  const allowed = allowedOrigins(env);
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
};

const json = (data: unknown, status: number, headers: Record<string, string>): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(status >= 400 ? { 'cache-control': 'no-store' } : {}),
      ...headers,
    },
  });

export const isInternalName = (host: string): boolean =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  host.endsWith('.local') ||
  host.endsWith('.internal') ||
  host.endsWith('.home.arpa');

export const canonicalHost = (hostname: string): string => {
  let host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  try {
    const url = new URL(host.includes(':') ? `http://[${host}]` : `http://${host}`);
    host = url.hostname.replace(/^\[|\]$/g, '');
  } catch {
  }
  return host.replace(/\.$/, '');
};

const parseIpv4 = (host: string): number[] | null => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
};

const parseIpv6 = (host: string): number[] | null => {
  if (!host.includes(':')) return null;
  let text = host;
  const tail: number[] = [];
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (dotted) {
    const v4 = parseIpv4(dotted[1]!);
    if (!v4) return null;
    tail.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
    text = text.slice(0, dotted.index);
    if (!text.endsWith('::')) text = text.slice(0, -1);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const groups = (part: string): number[] =>
    part === '' ? [] : part.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  const head = groups(halves[0]!);
  let all = [...head, ...tail];
  if (halves.length === 2) {
    const rest = groups(halves[1]!);
    const missing = 8 - head.length - rest.length - tail.length;
    if (missing < 1) return null;
    all = [...head, ...new Array<number>(missing).fill(0), ...rest, ...tail];
  }
  return all.length === 8 && !all.some(Number.isNaN) ? all : null;
};

const isInternalIpv4 = ([a, b, c]: number[]): boolean =>
  a === 0 ||
  a === 10 ||
  a === 127 ||
  (a === 100 && b! >= 64 && b! <= 127) ||
  (a === 169 && b === 254) ||
  (a === 172 && b! >= 16 && b! <= 31) ||
  (a === 192 && b === 0 && (c === 0 || c === 2)) ||
  (a === 192 && b === 168) ||
  (a === 198 && (b === 18 || b === 19)) ||
  (a === 198 && b === 51 && c === 100) ||
  (a === 203 && b === 0 && c === 113) ||
  a! >= 224;

const isInternalIpv6 = (g: number[]): boolean => {
  const embedded = (hi: number, lo: number): boolean =>
    isInternalIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  const zeros = (from: number, to: number): boolean => g.slice(from, to).every((x) => x === 0);
  if (zeros(0, 5) && g[5] === 0xffff) return embedded(g[6]!, g[7]!);
  if (zeros(0, 4) && g[4] === 0xffff && g[5] === 0) return embedded(g[6]!, g[7]!);
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return embedded(g[6]!, g[7]!);
  if (g[0] === 0x2002) return embedded(g[1]!, g[2]!);
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return true;
  return (g[0]! & 0xe000) !== 0x2000;
};

export const ipVerdict = (host: string): boolean | null => {
  const v4 = parseIpv4(host);
  if (v4) return isInternalIpv4(v4);
  const v6 = parseIpv6(host);
  return v6 ? isInternalIpv6(v6) : null;
};

interface DohResponse {
  Status?: number;
  Answer?: { type: number; data: string }[];
}

export const resolveDoh = async (name: string, type: 'A' | 'AAAA'): Promise<string[]> => {
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', name);
  url.searchParams.set('type', type);
  const res = await fetch(url, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(3_000),
    redirect: 'manual',
  });
  if (!res.ok) throw new Error('Falha ao verificar o DNS do destino.');
  const data = JSON.parse((await readBodyLimited(res, 64_000)).text) as DohResponse;
  if (data.Status === 3) return [];
  if (data.Status !== 0) throw new Error('DNS do destino não foi confirmado.');
  return (data.Answer ?? []).filter((a) => a.type === (type === 'A' ? 1 : 28)).map((a) => a.data);
};

type HostStatus = 'public' | 'blocked' | 'unresolved';

export type DnsCache = Map<string, Promise<HostStatus>>;

const classifyHost = async (host: string): Promise<HostStatus> => {
  if (isInternalName(host)) return 'blocked';
  const literal = ipVerdict(host);
  if (literal !== null) return literal ? 'blocked' : 'public';

  const results = await Promise.allSettled([resolveDoh(host, 'A'), resolveDoh(host, 'AAAA')]);
  const answers = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (answers.some((ip) => ipVerdict(canonicalHost(ip)) !== false)) return 'blocked';
  if (answers.length > 0) return 'public';
  return results.some((r) => r.status === 'rejected') ? 'unresolved' : 'blocked';
};

const subrequestBudgets = new WeakMap<DnsCache, { used: number; max: number }>();

export const createAuditDns = (max = MAX_SUBREQUESTS_PER_AUDIT): DnsCache => {
  const dns: DnsCache = new Map();
  subrequestBudgets.set(dns, { used: 0, max });
  return dns;
};

const spendSubrequests = (dns: DnsCache, count: number): void => {
  const budget = subrequestBudgets.get(dns);
  if (!budget) return;
  if (budget.used + count > budget.max) {
    throw new SubrequestLimitError(
      `A auditoria passou do limite de ${budget.max} requisições. O site tem redirecionamentos ou sitemaps demais para analisar.`,
    );
  }
  budget.used += count;
};

const lookupHost = (hostname: string, dns: DnsCache): Promise<HostStatus> => {
  const host = canonicalHost(hostname);
  let pending = dns.get(host);
  if (!pending) {
    if (!isInternalName(host) && ipVerdict(host) === null) spendSubrequests(dns, 2);
    pending = classifyHost(host);
    dns.set(host, pending);
  }
  return pending;
};

export const isInternalHost = async (hostname: string, dns: DnsCache = new Map()): Promise<boolean> =>
  (await lookupHost(hostname, dns)) !== 'public';

const validateTarget = async (url: URL, dns: DnsCache): Promise<void> => {
  const shapeOk = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
    !url.port && url.hostname.includes('.');
  const status = shapeOk ? await lookupHost(url.hostname, dns) : 'blocked';
  if (status === 'blocked') throw new BlockedTargetError('Destino público HTTP inválido.');
  if (status === 'unresolved') throw new AuditError('Não foi possível confirmar o DNS do destino.');
};

export const normalizeTarget = async (raw: string, dns: DnsCache = new Map()): Promise<URL | null> => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    await validateTarget(url, dns);
    return url;
  } catch {
    return null;
  }
};

export const fetchWithTimeout = async (
  url: string,
  { signal, dns = new Map() }: { signal?: AbortSignal; dns?: DnsCache } = {},
): Promise<Response> => {
  await validateTarget(new URL(url), dns);
  spendSubrequests(dns, 1);
  return fetch(url, {
    method: 'GET',
    redirect: 'manual',
    signal: signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9',
    },
  });
};

interface RedirectPolicy {
  maxHops?: number;
  allowUrl?: (url: URL) => boolean;
}

const followRedirects = async (
  start: URL,
  dns: DnsCache,
  { maxHops = 6, allowUrl }: RedirectPolicy = {},
): Promise<{ response: Response; hops: RedirectHop[]; finalUrl: string; elapsedMs: number }> => {
  const hops: RedirectHop[] = [];
  let current = start.toString();
  const began = Date.now();
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const checkScope = (url: URL) => {
    if (allowUrl && !allowUrl(url)) throw new OutOfScopeError('Destino fora do host do site auditado.');
  };
  checkScope(start);

  for (let i = 0; i < maxHops; i += 1) {
    const response = await fetchWithTimeout(current, { signal, dns });
    const location = response.headers.get('location');

    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      const next = new URL(location, current);
      checkScope(next);
      await validateTarget(next, dns);
      hops.push({ url: current, status: response.status, location });
      current = next.toString();
      continue;
    }

    return { response, hops, finalUrl: current, elapsedMs: Date.now() - began };
  }

  throw new AuditError('Cadeia de redirecionamentos longa demais (possível laço).');
};

export const checkHttpsUpgrade = async (
  hostname: string,
  dns: DnsCache = new Map(),
): Promise<boolean | null> => {
  try {
    const response = await fetchWithTimeout(`http://${hostname}/`, { dns });
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (response.status >= 300 && response.status < 400 && location) {
      return new URL(location, `http://${hostname}/`).protocol === 'https:';
    }
    return false;
  } catch {
    return null;
  }
};

export const readBodyLimited = async (
  response: Response, limit = MAX_HTML_BYTES, timeoutMs = FETCH_TIMEOUT_MS,
): Promise<{ text: string; bytes: number }> => {
  if (!response.body) return { text: '', bytes: 0 };
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const deadline = AbortSignal.timeout(timeoutMs);
  const aborted = () => { void reader.cancel().catch(() => {}); };
  deadline.addEventListener('abort', aborted, { once: true });
  let text = '';
  let bytes = 0;
  try {
    while (bytes < limit) {
      const { done, value } = await reader.read();
      deadline.throwIfAborted();
      if (done) break;
      const chunk = value.subarray(0, limit - bytes);
      text += decoder.decode(chunk, { stream: true });
      bytes += chunk.length;
    }
    text += decoder.decode();
    return { text, bytes };
  } finally {
    deadline.removeEventListener('abort', aborted);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};

const SITEMAP_NOT_FOUND: SitemapReport = { found: false, url: null, urlCount: null, isIndex: false };

export const isSitemapHostAllowed = (hostname: string, siteHostname: string): boolean => {
  const host = canonicalHost(hostname);
  const site = canonicalHost(siteHostname);
  if (host === site) return true;
  if (ipVerdict(site) !== null) return false;
  return host === `www.${site}` || `www.${host}` === site;
};

const AUX_MAX_HOPS = 3;

export const auditRobotsAndSitemap = async (
  origin: string,
  dns: DnsCache = new Map(),
): Promise<{ robots: RobotsReport | null; sitemap: SitemapReport }> => {
  let robots: RobotsReport | null = null;
  let limitReached = false;

  try {
    const { response } = await followRedirects(new URL(`${origin}/robots.txt`), dns, { maxHops: AUX_MAX_HOPS });
    const body = (await readBodyLimited(response, 128_000)).text;
    const looksLikeRobots = response.ok && !/<html/i.test(body.slice(0, 200));
    robots = looksLikeRobots ? parseRobots(body) : { found: false, blocksAll: false, sitemaps: [] };
  } catch (error) {
    if (error instanceof SubrequestLimitError) limitReached = true;
    robots = null;
  }

  const siteHost = new URL(origin).hostname;
  const sitemapPolicy: RedirectPolicy = {
    maxHops: AUX_MAX_HOPS,
    allowUrl: (url) => isSitemapHostAllowed(url.hostname, siteHost),
  };
  const candidates = [...(robots?.sitemaps ?? []), `${origin}/sitemap.xml`];
  type Attempt = SitemapReport | 'falha' | 'limite' | 'fora' | null;
  const promises = candidates.slice(0, 3).map(async (candidate): Promise<Attempt> => {
    try {
      const { response } = await followRedirects(new URL(candidate), dns, sitemapPolicy);
      if (!response.ok) { await response.body?.cancel(); return null; }
      const xml = (await readBodyLimited(response, 1_000_000)).text;
      if (!/<(urlset|sitemapindex)/i.test(xml)) return null;
      return {
        found: true,
        url: candidate,
        urlCount: countSitemapUrls(xml),
        isIndex: isSitemapIndex(xml),
      };
    } catch (error) {
      if (error instanceof SubrequestLimitError) return 'limite';
      if (error instanceof OutOfScopeError) return 'fora';
      return error instanceof BlockedTargetError ? null : 'falha';
    }
  });

  let failed = false;
  let outOfScope = false;
  for (const promise of promises) {
    const entry = await promise;
    if (entry === 'limite') limitReached = true;
    else if (entry === 'fora') outOfScope = true;
    else if (entry === 'falha') failed = true;
    else if (entry !== null) return { robots, sitemap: entry };
  }

  const unverified = (error: string): { robots: RobotsReport | null; sitemap: SitemapReport } =>
    ({ robots, sitemap: { ...SITEMAP_NOT_FOUND, error } });
  if (limitReached) {
    return unverified(
      `O limite de ${MAX_SUBREQUESTS_PER_AUDIT} requisições por auditoria acabou durante a verificação de robots.txt e sitemap. A ausência do sitemap não foi confirmada.`,
    );
  }
  if (outOfScope) {
    return unverified('O robots.txt cita sitemap em outro domínio, que a auditoria não consulta. A ausência não foi confirmada.');
  }
  return failed
    ? unverified('Não foi possível consultar o sitemap. A ausência não foi confirmada.')
    : { robots, sitemap: SITEMAP_NOT_FOUND };
};

const createErrorAuditResponse = (
  input: string,
  error: string,
  checkedAt: string,
): AuditResponse => ({
  ok: false,
  error,
  input,
  requestedUrl: input,
  finalUrl: input,
  status: 0,
  redirects: [],
  servedOverHttps: false,
  httpRedirectsToHttps: null,
  edgeResponseMs: 0,
  server: null,
  poweredBy: null,
  cacheControl: null,
  contentEncoding: null,
  compressed: false,
  securityHeaders: {
    hsts: null,
    contentTypeOptions: null,
    frameOptions: null,
    csp: null,
    referrerPolicy: null,
    permissionsPolicy: null,
  },
  html: null,
  robots: null,
  sitemap: { found: false, url: null, urlCount: null, isIndex: false },
  checkedAt,
});

const createSuccessAuditResponse = (
  input: string,
  target: URL,
  checkedAt: string,
  response: Response,
  hops: RedirectHop[],
  finalUrl: string,
  elapsedMs: number,
  text: string,
  bytes: number,
  httpRedirectsToHttps: boolean | null,
  robotsAndSitemap: { robots: RobotsReport | null; sitemap: AuditResponse['sitemap'] },
): AuditResponse => {
  const header = (name: string): string | null => response.headers.get(name);
  const contentType = header('content-type') ?? '';
  const isHtml = contentType.includes('html') || /<html/i.test(text.slice(0, 500));

  return {
    ok: response.ok,
    input,
    requestedUrl: target.toString(),
    finalUrl,
    status: response.status,
    redirects: hops,
    servedOverHttps: finalUrl.startsWith('https://'),
    httpRedirectsToHttps,
    edgeResponseMs: elapsedMs,
    server: header('server'),
    poweredBy: header('x-powered-by'),
    cacheControl: header('cache-control'),
    contentEncoding: header('content-encoding'),
    compressed:
      header('content-encoding') !== null ||
      /cloudflare|vercel|netlify|cloudfront|fastly|akamai/i.test(header('server') ?? ''),
    securityHeaders: {
      hsts: header('strict-transport-security'),
      contentTypeOptions: header('x-content-type-options'),
      frameOptions: header('x-frame-options'),
      csp: header('content-security-policy'),
      referrerPolicy: header('referrer-policy'),
      permissionsPolicy: header('permissions-policy'),
    },
    html: isHtml ? parseHtml(text, bytes) : null,
    robots: robotsAndSitemap.robots,
    sitemap: robotsAndSitemap.sitemap,
    checkedAt,
  };
};

const runAudit = async (input: string): Promise<AuditResponse> => {
  const dns = createAuditDns();
  const target = await normalizeTarget(input, dns);
  const checkedAt = new Date().toISOString();

  if (!target) {
    return createErrorAuditResponse(input, 'Domínio inválido. Use o formato exemplo.com.br', checkedAt);
  }

  const { response, hops, finalUrl, elapsedMs } = await followRedirects(target, dns);
  const finalOrigin = new URL(finalUrl).origin;

  const [{ text, bytes }, httpRedirectsToHttps, robotsAndSitemap] = await Promise.all([
    readBodyLimited(response),
    checkHttpsUpgrade(target.hostname, dns),
    auditRobotsAndSitemap(finalOrigin, dns),
  ]);

  return createSuccessAuditResponse(
    input,
    target,
    checkedAt,
    response,
    hops,
    finalUrl,
    elapsedMs,
    text,
    bytes,
    httpRedirectsToHttps,
    robotsAndSitemap
  );
};

const isTimeout = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error &&
  (error.name === 'AbortError' || error.name === 'TimeoutError');

const PAGESPEED_TIMEOUT_MS = 45_000;
const MAX_PAGESPEED_BYTES = 12_000_000;

const PAGESPEED_CACHE_TTL_MS = 10 * 60 * 1000;
const PAGESPEED_CACHE_MAX_CHARS = 8_000_000;

class PageSpeedCache {
  private entries = new Map<string, { body: string; expiresAt: number }>();
  private chars = 0;

  get(key: string, now: number): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt > now) return entry.body;
    this.delete(key);
    return null;
  }

  set(key: string, body: string, now: number): void {
    if (body.length > PAGESPEED_CACHE_MAX_CHARS) return;
    this.delete(key);
    for (const [oldKey, entry] of this.entries) {
      if (entry.expiresAt > now && this.chars + body.length <= PAGESPEED_CACHE_MAX_CHARS) break;
      this.delete(oldKey);
    }
    this.entries.set(key, { body, expiresAt: now + PAGESPEED_CACHE_TTL_MS });
    this.chars += body.length;
  }

  clear(): void {
    this.entries.clear();
    this.chars = 0;
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.chars -= entry.body.length;
    this.entries.delete(key);
  }
}

export const pageSpeedCache = new PageSpeedCache();

export const PAGESPEED_UPSTREAM_LIMITS = {
  perBlockPerMinute: 4,
  perIsolatePerMinute: 6,
  perIsolatePerHour: 250,
} as const;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

class FixedWindow {
  private count = 0;
  private resetAt = 0;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  hasRoom(now: number): boolean {
    if (now >= this.resetAt) {
      this.count = 0;
      this.resetAt = now + this.windowMs;
    }
    return this.count < this.limit;
  }

  spend(): void {
    this.count += 1;
  }

  clear(): void {
    this.count = 0;
    this.resetAt = 0;
  }
}

class PageSpeedUpstreamBudget {
  private readonly blocks = new Map<string, { count: number; expiresAt: number }>();
  private readonly minute = new FixedWindow(PAGESPEED_UPSTREAM_LIMITS.perIsolatePerMinute, MINUTE_MS);
  private readonly hour = new FixedWindow(PAGESPEED_UPSTREAM_LIMITS.perIsolatePerHour, HOUR_MS);

  reserve(block: string, now: number): 'bloco' | 'minuto' | 'hora' | null {
    this.dropExpired(now);
    const record = this.blocks.get(block);
    if ((record?.count ?? 0) >= PAGESPEED_UPSTREAM_LIMITS.perBlockPerMinute) return 'bloco';
    if (!this.minute.hasRoom(now)) return 'minuto';
    if (!this.hour.hasRoom(now)) return 'hora';
    this.minute.spend();
    this.hour.spend();
    if (record) record.count += 1;
    else this.blocks.set(block, { count: 1, expiresAt: now + MINUTE_MS });
    return null;
  }

  clear(): void {
    this.blocks.clear();
    this.minute.clear();
    this.hour.clear();
  }

  private dropExpired(now: number): void {
    for (const [block, record] of this.blocks) {
      if (record.expiresAt > now) break;
      this.blocks.delete(block);
    }
  }
}

export const pageSpeedUpstream = new PageSpeedUpstreamBudget();

const pageSpeedUnavailable = (status: number, headers: Record<string, string>): Response =>
  json({ error: 'PageSpeed indisponível.' }, status, headers);

const pageSpeedResponse = (body: string, headers: Record<string, string>): Response => new Response(body, {
  status: 200,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers, 'cache-control': 'no-store' },
});

const fetchPageSpeed = (target: URL, strategy: string, env: Env): Promise<Response> => {
  const params = new URLSearchParams({ url: target.toString(), strategy });
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) params.append('category', category);
  const googleHeaders: Record<string, string> = { referer: `${allowedOrigins(env)[0]}/` };
  if (env.PSI_KEY) googleHeaders['x-goog-api-key'] = env.PSI_KEY;
  return fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
    headers: googleHeaders,
    redirect: 'manual',
    signal: AbortSignal.timeout(PAGESPEED_TIMEOUT_MS),
  });
};

const upstreamCode = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z_]{1,64}$/.test(value) ? value : undefined;

const pageSpeedUpstreamError = async (response: Response, headers: Record<string, string>): Promise<Response> => {
  const reason = await readBodyLimited(response, 4_000)
    .then(({ text }) => (JSON.parse(text) as { error?: { status?: unknown; errors?: { reason?: unknown }[] } }).error)
    .catch(() => undefined);
  console.warn(
    'pagespeed upstream error', response.status, upstreamCode(reason?.status), upstreamCode(reason?.errors?.[0]?.reason),
  );
  return pageSpeedUnavailable(response.status >= 400 && response.status < 600 ? response.status : 502, headers);
};

const proxyPageSpeed = async (
  url: URL, env: Env, headers: Record<string, string>, block: string,
): Promise<Response> => {
  const target = await normalizeTarget(url.searchParams.get('domain') ?? '');
  const strategy = url.searchParams.get('strategy') ?? 'mobile';
  if (!target || !['mobile', 'desktop'].includes(strategy)) return json({ error: 'Destino inválido.' }, 400, headers);
  const cacheKey = `${strategy}:${target.href}`;
  const cached = pageSpeedCache.get(cacheKey, Date.now());
  if (cached !== null) return pageSpeedResponse(cached, headers);
  const exhausted = pageSpeedUpstream.reserve(block, Date.now());
  if (exhausted) {
    console.warn('pagespeed upstream cap reached', exhausted);
    return pageSpeedUnavailable(429, headers);
  }
  try {
    const response = await fetchPageSpeed(target, strategy, env);
    if (!response.ok) return await pageSpeedUpstreamError(response, headers);
    const { text, bytes } = await readBodyLimited(response, MAX_PAGESPEED_BYTES, PAGESPEED_TIMEOUT_MS);
    if (bytes >= MAX_PAGESPEED_BYTES) return json({ error: 'Resposta do PageSpeed grande demais.' }, 502, headers);
    pageSpeedCache.set(cacheKey, text, Date.now());
    return pageSpeedResponse(text, headers);
  } catch (error) {
    return isTimeout(error)
      ? json({ error: 'O PageSpeed demorou demais para responder.' }, 504, headers)
      : pageSpeedUnavailable(502, headers);
  }
};

type RateLimitRecord = {
  count: number;
  expiresAt: number;
  prefixKey?: string;
};

class RateLimitTable extends Map<string, RateLimitRecord> {
  readonly prefixSlots = new Map<string, number>();

  override set(key: string, value: RateLimitRecord): this {
    this.release(super.get(key));
    if (value.prefixKey) this.prefixSlots.set(value.prefixKey, (this.prefixSlots.get(value.prefixKey) ?? 0) + 1);
    return super.set(key, value);
  }

  override delete(key: string): boolean {
    this.release(super.get(key));
    return super.delete(key);
  }

  override clear(): void {
    this.prefixSlots.clear();
    super.clear();
  }

  private release(record: RateLimitRecord | undefined): void {
    if (!record?.prefixKey) return;
    const slots = (this.prefixSlots.get(record.prefixKey) ?? 0) - 1;
    if (slots > 0) this.prefixSlots.set(record.prefixKey, slots);
    else this.prefixSlots.delete(record.prefixKey);
  }
}

export const rateLimitCache = new RateLimitTable();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMITS = { audit: 10, pagespeed: 30 } as const;
export const RATE_LIMIT_MAX_ENTRIES = 5000;
export const RATE_LIMIT_PREFIX_SLOTS = 32;
type RateLimitBucket = keyof typeof RATE_LIMITS;

export const rateLimitClient = (ip: string): string => {
  const groups = parseIpv6(canonicalHost(ip));
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6]! >> 8, groups[6]! & 0xff, groups[7]! >> 8, groups[7]! & 0xff].join('.');
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`;
};

export const rateLimitPrefix = (client: string): string => {
  if (client.endsWith('::/64')) return `${client.split(':').slice(0, 3).join(':')}::/48`;
  const octets = parseIpv4(client);
  return octets ? `${octets.slice(0, 3).join('.')}.0/24` : client;
};

const consumeRateLimit = (bucket: RateLimitBucket, client: string, prefix: string, now: number): number | null => {
  const max = RATE_LIMITS[bucket];
  const prefixKey = `${bucket}:${prefix}`;
  let key = `${bucket}:${client}`;
  let record = rateLimitCache.get(key);

  if (!record || record.expiresAt <= now) {
    rateLimitCache.delete(key);
    for (const [entry, value] of rateLimitCache) {
      if (value.expiresAt > now) break;
      rateLimitCache.delete(entry);
    }
    record = undefined;
    const full = rateLimitCache.size >= RATE_LIMIT_MAX_ENTRIES;
    if (full || (rateLimitCache.prefixSlots.get(prefixKey) ?? 0) >= RATE_LIMIT_PREFIX_SLOTS) {
      key = prefixKey;
      record = rateLimitCache.get(key);
      if (record && record.expiresAt <= now) {
        rateLimitCache.delete(key);
        record = undefined;
      }
      if (!record && rateLimitCache.size >= RATE_LIMIT_MAX_ENTRIES) {
        const oldest = rateLimitCache.keys().next().value;
        if (oldest !== undefined) rateLimitCache.delete(oldest);
      }
    }
  }

  if (record) {
    if (record.count >= max) return Math.ceil((record.expiresAt - now) / 1000);
    record.count += 1;
    return null;
  }
  const expiresAt = now + RATE_LIMIT_WINDOW_MS;
  rateLimitCache.set(key, key === prefixKey ? { count: 1, expiresAt } : { count: 1, expiresAt, prefixKey });
  return null;
};

const auditErrorMessage = (error: unknown): string => {
  if (isTimeout(error)) return 'O site não respondeu dentro de 12 segundos.';
  if (error instanceof AuditError) return error.message;
  console.error('audit failed', error);
  return error instanceof Error
    ? 'Não foi possível acessar o site. Confira o endereço e tente novamente.'
    : 'Falha desconhecida ao auditar o site.';
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!allowedHosts(env).includes(url.hostname)) {
      return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });
    }

    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return json({ error: 'Método não permitido' }, 405, headers);

    const clientIp = request.headers.get('cf-connecting-ip');
    if (!clientIp) return json({ error: 'Endereço do cliente não confirmado.' }, 403, headers);

    const bucket = url.pathname === '/pagespeed' ? 'pagespeed' : 'audit';
    const client = rateLimitClient(clientIp);
    const prefix = rateLimitPrefix(client);
    const retryAfter = consumeRateLimit(bucket, client, prefix, Date.now());
    if (retryAfter !== null) {
      return json({ error: 'Muitas requisições. Tente novamente mais tarde.', code: 'rate_limited' }, 429, {
        ...headers,
        'retry-after': retryAfter.toString(),
      });
    }

    if (!origin || !allowedOrigins(env).includes(origin)) {
      return json({ error: 'Origem não autorizada.' }, 403, headers);
    }

    if (url.pathname === '/pagespeed') return proxyPageSpeed(url, env, headers, prefix);
    if (url.pathname !== '/audit') {
      return json({ error: 'Rota não encontrada. Use /audit?url=exemplo.com.br' }, 404, headers);
    }

    const input = url.searchParams.get('url');
    if (!input) return json({ error: 'Parâmetro "url" é obrigatório.' }, 400, headers);

    try {
      const report = await runAudit(input);
      return json(report, 200, {
        ...headers,
        'cache-control': report.error ? 'no-store' : 'public, max-age=120',
      });
    } catch (error) {
      return json({ ok: false, error: auditErrorMessage(error), input }, 200, { ...headers, 'cache-control': 'no-store' });
    }
  },
};
