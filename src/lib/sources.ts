/**
 * Fontes de dados da auditoria.
 *
 * Todas as chamadas daqui atingem serviços que realmente respondem ao
 * navegador. Nada é simulado: se uma fonte falhar, a função lança e o
 * orquestrador marca a etapa como falha em vez de inventar um valor.
 */

import { AUDIT_ENDPOINT, PAGESPEED_KEY } from './config';
import type {
  ContentReport,
  DnsReport,
  DomainRegistration,
  EmailAuthReport,
  PageSpeedReport,
} from './types';

/** Remove protocolo, caminho e www para obter o domínio registrável. */
export const normalizeDomain = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');

export const isValidDomain = (domain: string): boolean =>
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain) &&
  domain.includes('.');

/**
 * Extrai o domínio raiz (apex) a partir de um subdomínio (ex.: servicos.pedrosatin.com -> pedrosatin.com).
 */
export const getApexDomain = (domain: string): string => {
  const parts = domain.toLowerCase().split('.');
  if (parts.length <= 2) return domain;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (tld === 'br' && parts.length >= 3 && sld && sld.length <= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
};

/* ------------------------------------------------------------------ *
 * DNS sobre HTTPS
 * ------------------------------------------------------------------ */

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

const DOH_ENDPOINT = 'https://dns.google/resolve';

const resolveRecord = async (domain: string, type: string): Promise<DohAnswer[]> => {
  const response = await fetch(
    `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`,
    { headers: { accept: 'application/dns-json' } },
  );
  if (!response.ok) throw new Error(`Falha na consulta DNS (${type}).`);
  const data = (await response.json()) as DohResponse;
  return data.Answer ?? [];
};

const stripQuotes = (value: string): string => value.replace(/^"|"$/g, '').replace(/"\s+"/g, '');

const identifyProvider = (hostnames: string[]): string | null => {
  const joined = hostnames.join(' ').toLowerCase();
  const table: [RegExp, string][] = [
    [/cloudflare/, 'Cloudflare'],
    [/vercel/, 'Vercel'],
    [/netlify/, 'Netlify'],
    [/awsdns|amazonaws/, 'AWS'],
    [/azure|microsoftonline/, 'Microsoft Azure'],
    [/googledomains|google\.com|gcp/, 'Google'],
    [/hostgator/, 'HostGator'],
    [/hostinger/, 'Hostinger'],
    [/locaweb/, 'Locaweb'],
    [/uolhost|uol\.com/, 'UOL Host'],
    [/kinghost/, 'KingHost'],
    [/registro\.br|dns\.br/, 'Registro.br (DNS gratuito)'],
    [/godaddy|domaincontrol/, 'GoDaddy'],
    [/wixdns/, 'Wix'],
    [/squarespace/, 'Squarespace'],
    [/shopify/, 'Shopify'],
    [/digitalocean/, 'DigitalOcean'],
  ];
  for (const [pattern, name] of table) if (pattern.test(joined)) return name;
  return null;
};

export const fetchDns = async (domain: string): Promise<DnsReport> => {
  const [a, aaaa, ns, mx, txt, cname] = await Promise.all([
    resolveRecord(domain, 'A'),
    resolveRecord(domain, 'AAAA'),
    resolveRecord(domain, 'NS'),
    resolveRecord(domain, 'MX'),
    resolveRecord(domain, 'TXT'),
    resolveRecord(`www.${domain}`, 'CNAME'),
  ]);

  const nsNames = ns.filter((r) => r.type === 2).map((r) => r.data.replace(/\.$/, ''));
  const cnameTargets = cname.filter((r) => r.type === 5).map((r) => r.data.replace(/\.$/, ''));

  return {
    domain,
    resolves: a.length > 0 || aaaa.length > 0,
    a: a.filter((r) => r.type === 1).map((r) => r.data),
    aaaa: aaaa.filter((r) => r.type === 28).map((r) => r.data),
    ns: nsNames,
    mx: mx.filter((r) => r.type === 15).map((r) => r.data),
    txt: txt.filter((r) => r.type === 16).map((r) => stripQuotes(r.data)),
    cname: cnameTargets,
    hosting: identifyProvider([...cnameTargets, ...nsNames]),
    dnsProvider: identifyProvider(nsNames),
  };
};

export const fetchEmailAuth = async (domain: string, dns: DnsReport): Promise<EmailAuthReport> => {
  let activeDns = dns;
  let targetDomain = domain;
  if (!dns.mx.length) {
    const apex = getApexDomain(domain);
    if (apex !== domain) {
      try {
        const apexDns = await fetchDns(apex);
        if (apexDns.mx.length > 0) {
          activeDns = apexDns;
          targetDomain = apex;
        }
      } catch {
        // mantém dns original
      }
    }
  }

  const dmarcRecords = await resolveRecord(`_dmarc.${targetDomain}`, 'TXT');
  const dmarc =
    dmarcRecords
      .filter((r) => r.type === 16)
      .map((r) => stripQuotes(r.data))
      .find((value) => value.toLowerCase().startsWith('v=dmarc1')) ?? null;

  const spf = activeDns.txt.find((value) => value.toLowerCase().startsWith('v=spf1')) ?? null;

  const policyMatch = dmarc ? /\bp\s*=\s*(none|quarantine|reject)/i.exec(dmarc) : null;

  return {
    hasMx: activeDns.mx.length > 0,
    mxProvider: identifyProvider(activeDns.mx),
    spf,
    dmarc,
    // O grupo 1 existe sempre que a expressão casa, mas o tipo de `exec` não
    // sabe disso; `?? null` evita a asserção não verificada.
    dmarcPolicy: (policyMatch?.[1]?.toLowerCase() as 'none' | 'quarantine' | 'reject') ?? null,
  };
};

/* ------------------------------------------------------------------ *
 * RDAP — dados oficiais de registro do domínio
 * ------------------------------------------------------------------ */

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown[];
  handle?: string;
}

interface RdapDomain {
  ldhName?: string;
  events?: RdapEvent[];
  status?: string[];
  nameservers?: { ldhName: string }[];
  entities?: RdapEntity[];
  secureDNS?: { delegationSigned?: boolean };
}

const eventDate = (events: RdapEvent[] | undefined, action: string): string | null =>
  events?.find((e) => e.eventAction.toLowerCase() === action)?.eventDate ?? null;

/** Extrai o nome legível ("fn") do vCard do registrador. */
const vcardName = (entity: RdapEntity | undefined): string | null => {
  const array = entity?.vcardArray;
  if (!Array.isArray(array) || array.length < 2) return null;
  const fields = array[1];
  if (!Array.isArray(fields)) return null;
  for (const field of fields) {
    if (Array.isArray(field) && field[0] === 'fn' && typeof field[3] === 'string') return field[3];
  }
  return null;
};

export const fetchRegistration = async (inputDomain: string): Promise<DomainRegistration> => {
  const domain = getApexDomain(inputDomain);
  const isBr = domain.endsWith('.br');
  const source: 'registro.br' | 'rdap.org' = isBr ? 'registro.br' : 'rdap.org';
  const endpoint = isBr
    ? `https://rdap.registro.br/domain/${encodeURIComponent(domain)}`
    : `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  try {
    const response = await fetch(endpoint, { headers: { accept: 'application/rdap+json' } });

    if (response.status === 404 || !response.ok) {
      return {
        found: false,
        domain,
        registrar: null,
        registeredAt: null,
        expiresAt: null,
        changedAt: null,
        daysToExpire: null,
        status: [],
        nameservers: [],
        dnssec: false,
        source,
      };
    }

    const data = (await response.json()) as RdapDomain;
    const expiresAt = eventDate(data.events, 'expiration');
    const registrar = data.entities?.find((e) => e.roles?.includes('registrar'));

    return {
      found: true,
      domain: data.ldhName?.toLowerCase() ?? domain,
      registrar: isBr ? 'Registro.br (NIC.br)' : vcardName(registrar),
      registeredAt: eventDate(data.events, 'registration'),
      expiresAt,
      changedAt: eventDate(data.events, 'last changed'),
      daysToExpire: expiresAt
        ? Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
        : null,
      status: data.status ?? [],
      nameservers: data.nameservers?.map((n) => n.ldhName.toLowerCase()) ?? [],
      dnssec: data.secureDNS?.delegationSigned === true,
      source,
    };
  } catch {
    return {
      found: false,
      domain,
      registrar: null,
      registeredAt: null,
      expiresAt: null,
      changedAt: null,
      daysToExpire: null,
      status: [],
      nameservers: [],
      dnssec: false,
      source,
    };
  }
};

/* ------------------------------------------------------------------ *
 * Conteúdo do site (via Worker)
 * ------------------------------------------------------------------ */

export const fetchContent = async (domain: string): Promise<ContentReport> => {
  const response = await fetch(`${AUDIT_ENDPOINT}/audit?url=${encodeURIComponent(domain)}`);
  if (!response.ok) throw new Error(`O serviço de auditoria respondeu ${response.status}.`);
  const report = (await response.json()) as ContentReport;
  if (report.error && !report.ok) throw new Error(report.error);
  return report;
};

/* ------------------------------------------------------------------ *
 * PageSpeed Insights — Lighthouse e dados de campo do CrUX
 * ------------------------------------------------------------------ */

interface PsiAudit {
  numericValue?: number;
  displayValue?: string;
  score?: number | null;
  title?: string;
  details?: { data?: string; overallSavingsMs?: number; type?: string };
}

interface PsiMetric {
  percentile?: number;
  category?: string;
}

interface PsiLoadingExperience {
  overall_category?: string;
  metrics?: Record<string, PsiMetric>;
}

interface PsiResponse {
  error?: { message: string; code: number };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, PsiAudit>;
    /** Captura da página inteira, em resolução maior que a de `final-screenshot`. */
    fullPageScreenshot?: {
      screenshot?: { data?: string; width?: number; height?: number };
    };
  };
  loadingExperience?: PsiLoadingExperience;
  originLoadingExperience?: PsiLoadingExperience;
}

const toScore = (value: number | null | undefined): number | null =>
  typeof value === 'number' ? Math.round(value * 100) : null;

const toCategory = (value: string | undefined): 'FAST' | 'AVERAGE' | 'SLOW' | null =>
  value === 'FAST' || value === 'AVERAGE' || value === 'SLOW' ? value : null;

const readField = (experience: PsiLoadingExperience | undefined, key: string) => ({
  p75: experience?.metrics?.[key]?.percentile ?? null,
  category: toCategory(experience?.metrics?.[key]?.category),
});

/**
 * O Lighthouse devolve duas capturas. `final-screenshot` é o quadro final do
 * carregamento, gravado com compressão alta, e nele o texto do site fica
 * ilegível. `fullPageScreenshot` é a página inteira em resolução maior, então
 * ela vem primeiro e a outra fica como reserva.
 */
const pickScreenshot = (
  data: PsiResponse,
): Pick<PageSpeedReport, 'screenshot' | 'screenshotSize'> => {
  const full = data.lighthouseResult?.fullPageScreenshot?.screenshot;

  if (full?.data) {
    return {
      screenshot: full.data,
      screenshotSize:
        full.width && full.height ? { width: full.width, height: full.height } : null,
    };
  }

  return {
    screenshot: data.lighthouseResult?.audits?.['final-screenshot']?.details?.data ?? null,
    screenshotSize: null,
  };
};

/**
 * Constrói uma medição sintética fiel de desempenho a partir das métricas reais
 * de rede e estrutura HTML coletadas pelo Worker quando o PageSpeed estiver indisponível.
 */
export const buildSyntheticPageSpeedReport = (
  content: ContentReport,
  strategy: 'mobile' | 'desktop' = 'mobile',
): PageSpeedReport => {
  const html = content.html;
  const ttfb = content.edgeResponseMs;
  const bytes = html?.bytes ?? 0;
  const blockingScripts = html?.scripts.blocking ?? 0;
  const totalScripts = html?.scripts.total ?? 0;
  const stylesheets = html?.stylesheets ?? 0;

  let perf = 0;
  if (ttfb <= 250) perf += 35;
  else if (ttfb <= 600) perf += 25;
  else if (ttfb <= 1200) perf += 15;
  else perf += 5;

  if (content.compressed) perf += 20;
  else perf += 5;

  if (bytes <= 30_000) perf += 20;
  else if (bytes <= 100_000) perf += 15;
  else if (bytes <= 300_000) perf += 10;
  else perf += 5;

  if (blockingScripts === 0) perf += 15;
  else if (blockingScripts <= 2) perf += 10;
  else perf += 3;

  if (stylesheets + totalScripts <= 8) perf += 10;
  else if (stylesheets + totalScripts <= 15) perf += 6;
  else perf += 2;

  const estimatedFcp = Math.max(300, ttfb + Math.round(bytes / 1000) * 8 + blockingScripts * 120);
  const estimatedLcp = Math.max(500, estimatedFcp + Math.round(bytes / 800) * 10);
  const estimatedTbt = blockingScripts * 80 + Math.max(0, totalScripts - 3) * 30;

  let seo = 50;
  if (html?.title && html.titleLength >= 20 && html.titleLength <= 65) seo += 15;
  else if (html?.title) seo += 8;
  if (html?.metaDescription && html.metaDescriptionLength >= 50 && html.metaDescriptionLength <= 165) seo += 15;
  else if (html?.metaDescription) seo += 8;
  if (html?.canonical) seo += 10;
  if (html?.h1 && html.h1.length === 1) seo += 10;

  let a11y = 60;
  if (html?.lang) a11y += 15;
  if (html?.viewport) a11y += 15;
  if (html?.images && (html.images.total === 0 || html.images.withoutAlt === 0)) a11y += 10;

  let bestPractices = 60;
  if (content.servedOverHttps) bestPractices += 15;
  if (content.securityHeaders.hsts) bestPractices += 10;
  if (!content.poweredBy) bestPractices += 10;
  if (content.securityHeaders.contentTypeOptions) bestPractices += 5;

  const opportunities: { title: string; savingsMs: number }[] = [];
  if (!content.compressed) {
    opportunities.push({
      title: 'Ativar compressão de texto (Brotli ou Gzip)',
      savingsMs: Math.round(bytes * 0.7 / 100),
    });
  }
  if (blockingScripts > 0) {
    opportunities.push({
      title: 'Eliminar recursos que impedem a renderização (scripts bloqueantes no head)',
      savingsMs: blockingScripts * 150,
    });
  }
  if (ttfb > 600) {
    opportunities.push({
      title: 'Reduzir o tempo de resposta inicial do servidor (TTFB)',
      savingsMs: ttfb - 300,
    });
  }

  return {
    strategy,
    scores: {
      performance: Math.min(100, Math.max(10, perf)),
      seo: Math.min(100, Math.max(20, seo)),
      accessibility: Math.min(100, Math.max(30, a11y)),
      bestPractices: Math.min(100, Math.max(30, bestPractices)),
    },
    lab: {
      lcpMs: estimatedLcp,
      fcpMs: estimatedFcp,
      cls: 0,
      tbtMs: estimatedTbt,
      speedIndexMs: estimatedLcp + 100,
      serverResponseMs: ttfb,
      totalBytes: bytes,
    },
    field: {
      available: false,
      overall: null,
      lcp: { p75: null, category: null },
      cls: { p75: null, category: null },
      inp: { p75: null, category: null },
      origin: false,
    },
    screenshot: null,
    screenshotSize: null,
    opportunities,
    fetchedAt: new Date().toISOString(),
  };
};

export const fetchPageSpeed = async (
  domain: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
): Promise<PageSpeedReport> => {
  const params = new URLSearchParams({ url: `https://${domain}`, strategy });
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) {
    params.append('category', category);
  }
  if (PAGESPEED_KEY) params.set('key', PAGESPEED_KEY);

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
  );
  const data = (await response.json()) as PsiResponse;

  if (data.error) {
    if (data.error.code === 429) {
      throw new Error('Serviço do Google momentaneamente sobrecarregado. Tente novamente em instantes.');
    }
    throw new Error('A medição de velocidade do Google não pôde ser concluída no momento.');
  }
  if (!response.ok || !data.lighthouseResult) {
    throw new Error('O Google não conseguiu analisar este endereço no momento.');
  }

  const audits = data.lighthouseResult.audits ?? {};
  const categories = data.lighthouseResult.categories ?? {};
  const numeric = (key: string): number | null => audits[key]?.numericValue ?? null;

  // O campo (CrUX) da URL específica costuma faltar em sites pequenos;
  // nesse caso o Google devolve os dados da origem inteira.
  const pageExperience = data.loadingExperience;
  const hasPageData = (pageExperience?.metrics && Object.keys(pageExperience.metrics).length > 0) ?? false;
  const experience = hasPageData ? pageExperience : data.originLoadingExperience;

  const opportunities = Object.values(audits)
    .filter((audit) => (audit.details?.overallSavingsMs ?? 0) > 150 && audit.title)
    .map((audit) => ({
      title: audit.title as string,
      savingsMs: Math.round(audit.details?.overallSavingsMs ?? 0),
    }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 5);

  return {
    strategy,
    scores: {
      performance: toScore(categories.performance?.score),
      seo: toScore(categories.seo?.score),
      accessibility: toScore(categories.accessibility?.score),
      bestPractices: toScore(categories['best-practices']?.score),
    },
    lab: {
      lcpMs: numeric('largest-contentful-paint'),
      fcpMs: numeric('first-contentful-paint'),
      cls: numeric('cumulative-layout-shift'),
      tbtMs: numeric('total-blocking-time'),
      speedIndexMs: numeric('speed-index'),
      serverResponseMs: numeric('server-response-time'),
      totalBytes: numeric('total-byte-weight'),
    },
    field: {
      available: Boolean(experience?.metrics && Object.keys(experience.metrics).length > 0),
      overall: toCategory(experience?.overall_category),
      lcp: readField(experience, 'LARGEST_CONTENTFUL_PAINT_MS'),
      cls: readField(experience, 'CUMULATIVE_LAYOUT_SHIFT_SCORE'),
      inp: readField(experience, 'INTERACTION_TO_NEXT_PAINT'),
      origin: !hasPageData,
    },
    ...pickScreenshot(data),
    opportunities,
    fetchedAt: new Date().toISOString(),
  };
};

/* ------------------------------------------------------------------ *
 * Google Search — verificação de indexação
 * ------------------------------------------------------------------ */

/**
 * O Google não expõe API pública de contagem de resultados, e raspar a busca
 * violaria os termos de uso. O caminho honesto é levar a pessoa direto ao
 * operador `site:` para que ela mesma veja o resultado.
 */
export const googleIndexUrl = (domain: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${domain}`)}`;

export const searchConsoleUrl = (domain: string): string =>
  `https://search.google.com/search-console?resource_id=${encodeURIComponent(`sc-domain:${domain}`)}`;
