/**
 * Worker de auditoria de sites — servicos.pedrosatin.com
 *
 * O navegador não consegue ler o HTML de um site de terceiros: a política de
 * mesma origem bloqueia a resposta a menos que o site envie
 * `Access-Control-Allow-Origin`, o que praticamente nenhum site institucional
 * faz. Este Worker faz a requisição do lado do servidor e devolve um relatório
 * já processado, com CORS liberado para a landing page.
 *
 * Rota: GET /audit?url=<domínio ou URL>
 */

import {
  countSitemapUrls,
  isSitemapIndex,
  parseHtml,
  parseRobots,
  type HtmlReport,
  type RobotsReport,
} from './parse.ts';

interface Env {
  ALLOWED_ORIGINS?: string;
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

interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

interface SecurityHeaders {
  hsts: string | null;
  contentTypeOptions: string | null;
  frameOptions: string | null;
  csp: string | null;
  referrerPolicy: string | null;
  permissionsPolicy: string | null;
}

interface AuditResponse {
  ok: boolean;
  error?: string;
  input: string;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirects: RedirectHop[];
  servedOverHttps: boolean;
  httpRedirectsToHttps: boolean | null;
  edgeResponseMs: number;
  server: string | null;
  poweredBy: string | null;
  cacheControl: string | null;
  contentEncoding: string | null;
  compressed: boolean;
  securityHeaders: SecurityHeaders;
  html: HtmlReport | null;
  robots: RobotsReport | null;
  sitemap: { found: boolean; url: string | null; urlCount: number | null; isIndex: boolean };
  checkedAt: string;
}

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
 * varredura. A lista cobre laço local, as três faixas privadas do IPv4,
 * link-local, IPv6 local e os sufixos usados em redes internas.
 */
const isInternalIp = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return true;
  }
  if (host === '::1' || host === '0.0.0.0') return true;
  // IPv6 único-local (fc00::/7) e link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return true;

  const cleaned = host.replace(/^::ffff:/, '');
  let ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(cleaned);

  if (!ipv4) {
    const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
    if (mapped) {
      const p1 = parseInt(mapped[1], 16);
      const p2 = parseInt(mapped[2], 16);
      ipv4 = ["", String(p1 >> 8), String(p1 & 0xff), String(p2 >> 8), String(p2 & 0xff)] as unknown as RegExpExecArray;
    }
  }
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const resolveDoh = async (name: string, type: 'A' | 'AAAA'): Promise<string[]> => {
  try {
    const url = new URL('https://cloudflare-dns.com/dns-query');
    url.searchParams.set('name', name);
    url.searchParams.set('type', type);
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/dns-json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (data.Answer || []).map((a: any) => a.data);
  } catch {
    return [];
  }
};

export const isInternalHost = async (hostname: string): Promise<boolean> => {
  // Ignora se for IP (já avaliado) e resolve domínio
  if (isInternalIp(hostname)) return true;

  const [ipv4s, ipv6s] = await Promise.all([
    resolveDoh(hostname, 'A'),
    resolveDoh(hostname, 'AAAA'),
  ]);

  for (const ip of [...ipv4s, ...ipv6s]) {
    if (isInternalIp(ip)) return true;
  }
  return false;
};

/** Normaliza "exemplo.com.br", "www.exemplo.com/x" ou uma URL completa. */
export const normalizeTarget = async (raw: string): Promise<URL | null> => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    if (await isInternalHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
};

export const fetchWithTimeout = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'pt-BR,pt;q=0.9',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

/** Segue redirects manualmente para expor a cadeia inteira ao cliente. */
const followRedirects = async (
  start: URL,
): Promise<{ response: Response; hops: RedirectHop[]; finalUrl: string; elapsedMs: number }> => {
  const hops: RedirectHop[] = [];
  let current = start.toString();
  const began = Date.now();

  for (let i = 0; i < 6; i += 1) {
    const response = await fetchWithTimeout(current, { redirect: 'manual' });
    const location = response.headers.get('location');

    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, current);
      // O destino de um redirecionamento é escolhido pelo site auditado, não
      // por quem pediu a análise. Sem revalidar aqui, um site poderia mandar o
      // Worker buscar um endereço da rede interna.
      if (next.protocol !== 'https:' && next.protocol !== 'http:') {
        throw new Error(`Redirecionamento para um esquema não suportado: ${next.protocol}`);
      }
      if (await isInternalHost(next.hostname)) {
        throw new Error('O site redireciona para um endereço de rede interna.');
      }
      hops.push({ url: current, status: response.status, location });
      current = next.toString();
      continue;
    }

    return { response, hops, finalUrl: current, elapsedMs: Date.now() - began };
  }

  throw new Error('Cadeia de redirecionamentos longa demais (possível laço).');
};

/** Verifica se a versão http:// do domínio força HTTPS. */
export const checkHttpsUpgrade = async (hostname: string): Promise<boolean | null> => {
  try {
    const response = await fetchWithTimeout(`http://${hostname}/`, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      return new URL(location, `http://${hostname}/`).protocol === 'https:';
    }
    return false;
  } catch {
    return null;
  }
};

const readBodyLimited = async (response: Response): Promise<{ text: string; bytes: number }> => {
  const buffer = await response.arrayBuffer();
  const bytes = buffer.byteLength;
  const slice = bytes > MAX_HTML_BYTES ? buffer.slice(0, MAX_HTML_BYTES) : buffer;
  // Sem `fatal`: byte inválido vira o caractere de substituição em vez de
  // lançar. Um HTML mal codificado ainda é analisável, e recusá-lo por isso
  // seria pior para quem está sendo auditado. É o comportamento padrão.
  return { text: new TextDecoder('utf-8').decode(slice), bytes };
};

export const auditRobotsAndSitemap = async (
  origin: string,
): Promise<{ robots: RobotsReport | null; sitemap: AuditResponse['sitemap'] }> => {
  let robots: RobotsReport | null = null;

  try {
    const response = await fetchWithTimeout(`${origin}/robots.txt`);
    const body = await response.text();
    // Muitos servidores devolvem a home com status 200 no lugar de um 404.
    const looksLikeRobots = response.ok && !/<html/i.test(body.slice(0, 200));
    robots = looksLikeRobots ? parseRobots(body) : { found: false, blocksAll: false, sitemaps: [] };
  } catch {
    robots = null;
  }

  const candidates = [...(robots?.sitemaps ?? []), `${origin}/sitemap.xml`];
  for (const candidate of candidates.slice(0, 3)) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (!response.ok) continue;
      const xml = await response.text();
      if (!/<(urlset|sitemapindex)/i.test(xml)) continue;
      return {
        robots,
        sitemap: {
          found: true,
          url: candidate,
          urlCount: countSitemapUrls(xml),
          isIndex: isSitemapIndex(xml),
        },
      };
    } catch {
      // tenta o próximo candidato
    }
  }

  return { robots, sitemap: { found: false, url: null, urlCount: null, isIndex: false } };
};

const runAudit = async (input: string): Promise<AuditResponse> => {
  const target = await normalizeTarget(input);
  const checkedAt = new Date().toISOString();

  if (!target) {
    return {
      ok: false,
      error: 'Domínio inválido. Use o formato exemplo.com.br',
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
    };
  }

  const { response, hops, finalUrl, elapsedMs } = await followRedirects(target);
  const finalOrigin = new URL(finalUrl).origin;

  const [{ text, bytes }, httpRedirectsToHttps, robotsAndSitemap] = await Promise.all([
    readBodyLimited(response.clone()),
    checkHttpsUpgrade(target.hostname),
    auditRobotsAndSitemap(finalOrigin),
  ]);

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    const headers = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return json({ error: 'Método não permitido' }, 405, headers);

    // O cabeçalho CORS só é obedecido pelo navegador: sozinho, ele não impede
    // que outra página use este endpoint como back-end próprio. Recusar aqui
    // fecha esse uso. Um cliente fora do navegador pode forjar a origem, então
    // isto é controle de abuso casual, não autenticação.
    if (!origin || !allowedOrigins(env).includes(origin)) {
      return json({ error: 'Origem não autorizada.' }, 403, headers);
    }

    const url = new URL(request.url);
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
      const message =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'O site não respondeu dentro de 12 segundos.'
            : error.message
          : 'Falha desconhecida ao auditar o site.';
      return json({ ok: false, error: message, input }, 200, headers);
    }
  },
};
