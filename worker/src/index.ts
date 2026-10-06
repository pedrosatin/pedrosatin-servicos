/**
 * Worker de auditoria de sites — servicos.pedrosatin.com
 *
 * O navegador não consegue ler o HTML de um site de terceiros: a política de
 * mesma origem bloqueia a resposta a menos que o site envie
 * `Access-Control-Allow-Origin`, o que praticamente nenhum site institucional
 * faz. Este Worker faz a requisição do lado do servidor e devolve um relatório
 * já processado, com CORS liberado para a landing page.
 *
 * Rotas: GET /audit?url=<domínio ou URL>
 *        GET /pagespeed?domain=<domínio>&strategy=mobile|desktop
 */

import { countSitemapUrls, isSitemapIndex, parseHtml, parseRobots } from './parse.ts';
import type { AuditResponse, RedirectHop, RobotsReport, SitemapReport } from '../../shared/report-types.ts';

interface Env {
  ALLOWED_ORIGINS?: string;
  PSI_KEY?: string;
}

const DEFAULT_ORIGINS = [
  'https://servicos.pedrosatin.com',
  'https://pedrosatin.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

const USER_AGENT =
  'Mozilla/5.0 (compatible; PedroSatinAudit/1.0; +https://servicos.pedrosatin.com)';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3_000_000;

export const allowedOrigins = (env: Env): string[] => {
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === '') return DEFAULT_ORIGINS;
  const origins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) return DEFAULT_ORIGINS;
  return origins;
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
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

/**
 * Endereços que o Worker não deve alcançar. Ele existe para ler sites
 * públicos; apontá-lo para a rede interna o transformaria em proxy de
 * varredura. Os nomes cobrem laço local e os sufixos usados em redes internas;
 * as faixas de IP ficam em `isInternalIpv4` e `isInternalIpv6`.
 */
const isInternalName = (host: string): boolean =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  host.endsWith('.local') ||
  host.endsWith('.internal') ||
  host.endsWith('.home.arpa');

/**
 * Forma canônica do host: minúsculo, sem colchetes nem ponto final. O parser de
 * URL converte IPv4 escrito em decimal, hexadecimal ou octal para a notação
 * comum e compacta o IPv6, então `2130706433` e `0177.0.0.1` viram `127.0.0.1`.
 */
const canonicalHost = (hostname: string): string => {
  let host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  try {
    const url = new URL(host.includes(':') ? `http://[${host}]` : `http://${host}`);
    host = url.hostname.replace(/^\[|\]$/g, '');
  } catch {
    // Texto que não é host válido segue como veio e cai na consulta de DNS.
  }
  return host.replace(/\.$/, '');
};

const parseIpv4 = (host: string): number[] | null => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
};

/** Expande um IPv6 em oito grupos de 16 bits. Devolve null se não for IPv6. */
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
  a === 0 || // 0.0.0.0/8
  a === 10 ||
  a === 127 ||
  (a === 100 && b! >= 64 && b! <= 127) || // CGNAT, 100.64.0.0/10
  (a === 169 && b === 254) ||
  (a === 172 && b! >= 16 && b! <= 31) ||
  (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF e documentação
  (a === 192 && b === 168) ||
  (a === 198 && (b === 18 || b === 19)) || // testes de desempenho, 198.18.0.0/15
  (a === 198 && b === 51 && c === 100) ||
  (a === 203 && b === 0 && c === 113) ||
  a! >= 224; // multicast, 240.0.0.0/4 e broadcast

const isInternalIpv6 = (g: number[]): boolean => {
  const embedded = (hi: number, lo: number): boolean =>
    isInternalIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  const zeros = (from: number, to: number): boolean => g.slice(from, to).every((x) => x === 0);
  // ::ffff:a.b.c.d (mapeado) e ::ffff:0:a.b.c.d (traduzido) carregam um IPv4 no fim.
  if (zeros(0, 5) && g[5] === 0xffff) return embedded(g[6]!, g[7]!);
  if (zeros(0, 4) && g[4] === 0xffff && g[5] === 0) return embedded(g[6]!, g[7]!);
  // NAT64 (64:ff9b::/96) entrega o tráfego ao IPv4 dos últimos 32 bits.
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return embedded(g[6]!, g[7]!);
  // 6to4 (2002::/16) embute o IPv4 logo depois do prefixo.
  if (g[0] === 0x2002) return embedded(g[1]!, g[2]!);
  // Teredo (2001::/32) esconde o IPv4 e documentação (2001:db8::/32) não roteia.
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return true;
  // Fora de 2000::/3 não existe unicast global. Isso cobre ::, ::1, fc00::/7,
  // fe80::/10, fec0::/10, ff00::/8 e o NAT64 de uso local 64:ff9b:1::/48.
  return (g[0]! & 0xe000) !== 0x2000;
};

/** true para IP interno, false para IP público, null quando o host não é IP. */
const ipVerdict = (host: string): boolean | null => {
  const v4 = parseIpv4(host);
  if (v4) return isInternalIpv4(v4);
  const v6 = parseIpv6(host);
  return v6 ? isInternalIpv6(v6) : null;
};

interface DohResponse {
  Status?: number;
  Answer?: { type: number; data: string }[];
}

const resolveDoh = async (name: string, type: 'A' | 'AAAA'): Promise<string[]> => {
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
  // NXDOMAIN é resposta conclusiva: o nome não existe, então não há endereço.
  if (data.Status === 3) return [];
  if (data.Status !== 0) throw new Error('DNS do destino não foi confirmado.');
  return (data.Answer ?? []).filter((a) => a.type === (type === 'A' ? 1 : 28)).map((a) => a.data);
};

type HostStatus = 'public' | 'blocked' | 'unresolved';

/**
 * Resultado das consultas DoH por host, válido durante uma requisição. Uma
 * auditoria visita o mesmo host várias vezes (alvo, redirects, robots.txt,
 * sitemaps, versão http://), e cada consulta custa dois subrequests.
 */
export type DnsCache = Map<string, Promise<HostStatus>>;

const classifyHost = async (host: string): Promise<HostStatus> => {
  if (isInternalName(host)) return 'blocked';
  const literal = ipVerdict(host);
  if (literal !== null) return literal ? 'blocked' : 'public';

  const results = await Promise.allSettled([resolveDoh(host, 'A'), resolveDoh(host, 'AAAA')]);
  const answers = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  // Resposta que não é IP reconhecível também recusa: o critério falha fechado.
  if (answers.some((ip) => ipVerdict(canonicalHost(ip)) !== false)) return 'blocked';
  // Uma consulta pode falhar sozinha (servidor que responde mal a AAAA, por
  // exemplo). Se a outra trouxe só endereços públicos, o destino é aceito.
  if (answers.length > 0) return 'public';
  return results.some((r) => r.status === 'rejected') ? 'unresolved' : 'blocked';
};

const lookupHost = (hostname: string, dns: DnsCache): Promise<HostStatus> => {
  const host = canonicalHost(hostname);
  let pending = dns.get(host);
  if (!pending) {
    pending = classifyHost(host);
    dns.set(host, pending);
  }
  return pending;
};

export const isInternalHost = async (hostname: string, dns: DnsCache = new Map()): Promise<boolean> =>
  (await lookupHost(hostname, dns)) !== 'public';

/** Destino recusado pela política: endereço interno, inexistente ou URL fora do formato. */
export class BlockedTargetError extends Error {}

const validateTarget = async (url: URL, dns: DnsCache): Promise<void> => {
  const shapeOk = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
    !url.port && url.hostname.includes('.');
  const status = shapeOk ? await lookupHost(url.hostname, dns) : 'blocked';
  if (status === 'blocked') throw new BlockedTargetError('Destino público HTTP inválido.');
  if (status === 'unresolved') throw new Error('Não foi possível confirmar o DNS do destino.');
};

/** Normaliza "exemplo.com.br", "www.exemplo.com/x" ou uma URL completa. */
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
  // O mesmo sinal cobre cabeçalhos e corpo. O runtime do Worker bloqueia saída
  // para redes privadas; a checagem de DNS sozinha não fixa o IP que o fetch usa.
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

/** Segue redirects manualmente para expor a cadeia inteira ao cliente. */
const followRedirects = async (
  start: URL,
  dns: DnsCache,
): Promise<{ response: Response; hops: RedirectHop[]; finalUrl: string; elapsedMs: number }> => {
  const hops: RedirectHop[] = [];
  let current = start.toString();
  const began = Date.now();
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  for (let i = 0; i < 6; i += 1) {
    const response = await fetchWithTimeout(current, { signal, dns });
    const location = response.headers.get('location');

    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      const next = new URL(location, current);
      // O destino de um redirecionamento é escolhido pelo site auditado, não
      // por quem pediu a análise. Sem revalidar aqui, um site poderia mandar o
      // Worker buscar um endereço da rede interna. O cache evita repetir o DNS
      // quando o fetch da volta seguinte valida o mesmo host.
      await validateTarget(next, dns);
      hops.push({ url: current, status: response.status, location });
      current = next.toString();
      continue;
    }

    return { response, hops, finalUrl: current, elapsedMs: Date.now() - began };
  }

  throw new Error('Cadeia de redirecionamentos longa demais (possível laço).');
};

/** Verifica se a versão http:// do domínio força HTTPS. */
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
  // Sem `fatal`: byte inválido vira o caractere de substituição em vez de
  // lançar. Um HTML mal codificado ainda é analisável.
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

export const auditRobotsAndSitemap = async (
  origin: string,
  dns: DnsCache = new Map(),
): Promise<{ robots: RobotsReport | null; sitemap: SitemapReport }> => {
  let robots: RobotsReport | null = null;

  try {
    const { response } = await followRedirects(new URL(`${origin}/robots.txt`), dns);
    const body = (await readBodyLimited(response, 128_000)).text;
    // Muitos servidores devolvem a home com status 200 no lugar de um 404.
    const looksLikeRobots = response.ok && !/<html/i.test(body.slice(0, 200));
    robots = looksLikeRobots ? parseRobots(body) : { found: false, blocksAll: false, sitemaps: [] };
  } catch {
    robots = null;
  }

  const candidates = [...(robots?.sitemaps ?? []), `${origin}/sitemap.xml`];
  // Os candidatos são buscados em paralelo porque cada tentativa custa um
  // round-trip inteiro, mas a escolha continua respeitando a ordem original:
  // um sitemap declarado no robots.txt tem precedência sobre o /sitemap.xml
  // presumido, mesmo que o presumido responda primeiro.
  const promises = candidates.slice(0, 3).map(async (candidate): Promise<SitemapReport | 'falha' | null> => {
    try {
      const { response } = await followRedirects(new URL(candidate), dns);
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
      // Destino recusado pela política conta como ausente. Falha de rede, DNS
      // ou limite de subrequests deixa o resultado inconclusivo.
      return error instanceof BlockedTargetError ? null : 'falha';
    }
  });

  let failed = false;
  for (const promise of promises) {
    const entry = await promise;
    if (entry === 'falha') failed = true;
    else if (entry !== null) return { robots, sitemap: entry };
  }

  return {
    robots,
    sitemap: failed
      ? { ...SITEMAP_NOT_FOUND, error: 'Não foi possível consultar o sitemap. A ausência não foi confirmada.' }
      : SITEMAP_NOT_FOUND,
  };
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
  const dns: DnsCache = new Map();
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

const proxyPageSpeed = async (url: URL, env: Env, headers: Record<string, string>): Promise<Response> => {
  const target = await normalizeTarget(url.searchParams.get('domain') ?? '');
  const strategy = url.searchParams.get('strategy') ?? 'mobile';
  if (!target || !['mobile', 'desktop'].includes(strategy)) return json({ error: 'Destino inválido.' }, 400, headers);
  const params = new URLSearchParams({ url: target.toString(), strategy });
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) params.append('category', category);
  if (env.PSI_KEY) params.set('key', env.PSI_KEY);
  try {
    const response = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PAGESPEED_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status >= 400 && response.status < 600 ? response.status : 502;
      return json({ error: 'PageSpeed indisponível.' }, status, headers);
    }
    const { text, bytes } = await readBodyLimited(response, MAX_PAGESPEED_BYTES, PAGESPEED_TIMEOUT_MS);
    // Corpo cortado no teto não é JSON válido; melhor recusar aqui.
    if (bytes >= MAX_PAGESPEED_BYTES) return json({ error: 'Resposta do PageSpeed grande demais.' }, 502, headers);
    // O destino é fixo, então o corpo segue como texto, sem parse nem nova serialização.
    return new Response(text, {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', ...headers, 'cache-control': 'no-store' },
    });
  } catch (error) {
    return isTimeout(error)
      ? json({ error: 'O PageSpeed demorou demais para responder.' }, 504, headers)
      : json({ error: 'PageSpeed indisponível.' }, 502, headers);
  }
};

/**
 * Limite por IP, em janelas de um minuto, com orçamento separado por rota.
 * Uma auditoria completa faz uma chamada a /audit e duas a /pagespeed
 * (celular e computador), e o front repete cada medição até três vezes. Com
 * 30 chamadas ao PageSpeed por minuto cabem as 10 auditorias do /audit mesmo
 * com uma retentativa em cada medição.
 *
 * Chave: "<rota>:<ip>" -> { count, expiresAt }. O Map mantém a ordem de
 * inserção e toda janela nova vai para o fim, então as primeiras entradas são
 * sempre as que expiram antes.
 */
export const rateLimitCache = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMITS = { audit: 10, pagespeed: 30 } as const;
export const RATE_LIMIT_MAX_ENTRIES = 5000;

/** Devolve os segundos até a próxima janela quando o limite estourou, ou null. */
const consumeRateLimit = (key: string, max: number, now: number): number | null => {
  const record = rateLimitCache.get(key);
  if (record && record.expiresAt > now) {
    if (record.count >= max) return Math.ceil((record.expiresAt - now) / 1000);
    record.count += 1;
    return null;
  }

  rateLimitCache.delete(key);
  for (const [entry, value] of rateLimitCache) {
    if (value.expiresAt > now) break;
    rateLimitCache.delete(entry);
  }
  // Com o cache cheio de janelas ativas, descarta a mais antiga. Recusar todo
  // IP novo deixaria qualquer um com muitos endereços travar o serviço.
  if (rateLimitCache.size >= RATE_LIMIT_MAX_ENTRIES) {
    const oldest = rateLimitCache.keys().next().value;
    if (oldest !== undefined) rateLimitCache.delete(oldest);
  }
  rateLimitCache.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
  return null;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return json({ error: 'Método não permitido' }, 405, headers);

    const clientIp = request.headers.get('cf-connecting-ip');
    if (!clientIp) return json({ error: 'Endereço do cliente não confirmado.' }, 403, headers);

    const url = new URL(request.url);
    const bucket = url.pathname === '/pagespeed' ? 'pagespeed' : 'audit';
    const retryAfter = consumeRateLimit(`${bucket}:${clientIp}`, RATE_LIMITS[bucket], Date.now());
    if (retryAfter !== null) {
      // `code` separa este limite do 429 repassado pelo Google no /pagespeed.
      return json({ error: 'Muitas requisições. Tente novamente mais tarde.', code: 'rate_limited' }, 429, {
        ...headers,
        'retry-after': retryAfter.toString(),
      });
    }

    // O cabeçalho CORS só é obedecido pelo navegador: sozinho, ele não impede
    // que outra página use este endpoint como back-end próprio. Recusar aqui
    // fecha esse uso. Um cliente fora do navegador pode forjar a origem, então
    // isto é controle de abuso casual, não autenticação.
    if (!origin || !allowedOrigins(env).includes(origin)) {
      return json({ error: 'Origem não autorizada.' }, 403, headers);
    }

    if (url.pathname === '/pagespeed') return proxyPageSpeed(url, env, headers);
    if (url.pathname !== '/audit') {
      return json({ error: 'Rota não encontrada. Use /audit?url=exemplo.com.br' }, 404, headers);
    }

    const input = url.searchParams.get('url');
    if (!input) return json({ error: 'Parâmetro "url" é obrigatório.' }, 400, headers);

    try {
      const report = await runAudit(input);
      return json(report, 200, {
        ...headers,
        'cache-control': 'public, max-age=120',
      });
    } catch (error) {
      // `AbortSignal.timeout` aborta com TimeoutError; um AbortController, com AbortError.
      const message = isTimeout(error)
        ? 'O site não respondeu dentro de 12 segundos.'
        : error instanceof Error
          ? error.message
          : 'Falha desconhecida ao auditar o site.';
      return json({ ok: false, error: message, input }, 200, headers);
    }
  },
};
