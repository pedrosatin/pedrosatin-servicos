
import { AUDIT_ENDPOINT } from './config';
import { getApexDomain } from './dominio';
import type {
  ContentReport,
  DnsReport,
  DomainRegistration,
  EmailAuthReport,
  PageSpeedReport,
} from './types';

export interface SourcesDeps {
  fetch: typeof fetch;
  auditEndpoint: string;
  dohEndpoint: string;
}

const DOH_ENDPOINT = 'https://dns.google/resolve';

export const defaultSourcesDeps: SourcesDeps = {
  fetch: ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)) as typeof fetch,
  auditEndpoint: AUDIT_ENDPOINT,
  dohEndpoint: DOH_ENDPOINT,
};

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

const resolveRecord = async (
  domain: string,
  type: string,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<DohAnswer[]> => {
  const response = await deps.fetch(
    `${deps.dohEndpoint}?name=${encodeURIComponent(domain)}&type=${type}`,
    { headers: { accept: 'application/dns-json' } },
  );
  if (!response.ok) throw new Error(`Falha na consulta DNS (${type}).`);
  const data = (await response.json()) as DohResponse;
  return data.Answer ?? [];
};

const stripQuotes = (value: string): string => value.replace(/^"|"$/g, '').replace(/"\s+"/g, '');

const PROVIDER_TABLE: [RegExp, string][] = [
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

const identifyProvider = (hostnames: string[]): string | null => {
  const joined = hostnames.join(' ').toLowerCase();

  for (const [pattern, name] of PROVIDER_TABLE) if (pattern.test(joined)) return name;
  return null;
};

export const fetchDns = async (
  domain: string,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<DnsReport> => {
  const [a, aaaa, ns, mx, txt, cname] = await Promise.all([
    resolveRecord(domain, 'A', deps),
    resolveRecord(domain, 'AAAA', deps),
    resolveRecord(domain, 'NS', deps),
    resolveRecord(domain, 'MX', deps),
    resolveRecord(domain, 'TXT', deps),
    resolveRecord(`www.${domain}`, 'CNAME', deps),
  ]);

  const nsNames = ns.filter(r => r.type === 2).map(r => r.data.replace(/\.$/, ''));
  const cnameTargets = cname.filter(r => r.type === 5).map(r => r.data.replace(/\.$/, ''));

  return {
    domain,
    resolves: a.length > 0 || aaaa.length > 0,
    a: a.filter(r => r.type === 1).map(r => r.data),
    aaaa: aaaa.filter(r => r.type === 28).map(r => r.data),
    ns: nsNames,
    mx: mx.filter(r => r.type === 15).map(r => r.data),
    txt: txt.filter(r => r.type === 16).map(r => stripQuotes(r.data)),
    cname: cnameTargets,
    hosting: identifyProvider([...cnameTargets, ...nsNames]),
    dnsProvider: identifyProvider(nsNames),
  };
};

const resolveApexDns = async (
  domain: string,
  dns: DnsReport,
  deps: SourcesDeps = defaultSourcesDeps,
) => {
  if (dns.mx.length > 0) {
    return { activeDns: dns, targetDomain: domain };
  }

  const apex = getApexDomain(domain);
  if (apex === domain) {
    return { activeDns: dns, targetDomain: domain };
  }

  try {
    const [apexMxRecords, apexTxtRecords] = await Promise.all([
      resolveRecord(apex, 'MX', deps),
      resolveRecord(apex, 'TXT', deps),
    ]);

    const apexMx = apexMxRecords.filter((r) => r.type === 15).map((r) => r.data);
    if (apexMx.length > 0) {
      const apexTxt = apexTxtRecords.filter((r) => r.type === 16).map((r) => stripQuotes(r.data));
      return {
        activeDns: { ...dns, mx: apexMx, txt: apexTxt },
        targetDomain: apex,
      };
    }
  } catch {
  }

  return { activeDns: dns, targetDomain: domain };
};

export const fetchEmailAuth = async (
  domain: string,
  dns: DnsReport,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<EmailAuthReport> => {
  const { activeDns, targetDomain } = await resolveApexDns(domain, dns, deps);

  const dmarcRecords = await resolveRecord(`_dmarc.${targetDomain}`, 'TXT', deps);

  let dmarc: string | null = null;
  for (const r of dmarcRecords) {
    if (r.type === 16) {
      const value = stripQuotes(r.data);
      if (value.toLowerCase().startsWith('v=dmarc1')) {
        dmarc = value;
        break;
      }
    }
  }

  let spf: string | null = null;
  for (const value of activeDns.txt) {
    if (value.toLowerCase().startsWith('v=spf1')) {
      spf = value;
      break;
    }
  }

  const policyMatch = dmarc ? /\bp\s*=\s*(none|quarantine|reject)/i.exec(dmarc) : null;

  return {
    hasMx: activeDns.mx.length > 0,
    mxProvider: identifyProvider(activeDns.mx),
    spf,
    dmarc,
    dmarcPolicy: (policyMatch?.[1]?.toLowerCase() as 'none' | 'quarantine' | 'reject') ?? null,
  };
};

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

const vcardName = (entity: RdapEntity | undefined): string | null => {
  const array = entity?.vcardArray;
  if (!Array.isArray(array) || array.length < 2) return null;
  const fields = array[1];
  if (!Array.isArray(fields)) return null;
  const match = fields.find((field) => Array.isArray(field) && field[0] === 'fn' && typeof field[3] === 'string');
  return match ? (match[3] as string) : null;
};

export const fetchRegistration = async (
  inputDomain: string,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<DomainRegistration> => {
  const domain = getApexDomain(inputDomain);
  const isBr = domain.endsWith('.br');
  const source: 'registro.br' | 'rdap.org' = isBr ? 'registro.br' : 'rdap.org';
  const endpoint = isBr
    ? `https://rdap.registro.br/domain/${encodeURIComponent(domain)}`
    : `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  try {
    const response = await deps.fetch(endpoint, { headers: { accept: 'application/rdap+json' } });

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

const MENSAGEM_LIMITE_DO_WORKER =
  'Muitas análises seguidas a partir da sua conexão. Aguarde um minuto e tente de novo.';

export const fetchContent = async (
  domain: string,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<ContentReport> => {
  const res = await deps.fetch(
    `${deps.auditEndpoint}/audit?url=${encodeURIComponent(domain)}`,
  );
  if (!res.ok) {
    if (res.status === 429) throw new Error(MENSAGEM_LIMITE_DO_WORKER);
    if (res.status === 400 || res.status === 403) {
      throw new Error('Domínio inválido ou inacessível.');
    }
    throw new Error(`O servidor de análise falhou (status ${res.status}).`);
  }
  const report = (await res.json()) as ContentReport;
  if (report.error && !report.ok) throw new Error(report.error);
  return report;
};

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
  code?: string;
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, PsiAudit>;
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

const PAGESPEED_TENTATIVAS = 3;
const PAGESPEED_TIMEOUT_MS = 60_000;

const isErroDefinitivo = (status: number): boolean =>
  status === 400 || status === 403 || status === 404;

const esperar = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const esperaDaTentativa = (tentativa: number, foiLimiteDeUso: boolean): number => {
  const base = foiLimiteDeUso ? 5_000 : 1_000;
  return base * 2 ** (tentativa - 1) + (crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296) * 500;
};

const buscarPageSpeed = async (
  params: URLSearchParams,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS);
  try {
    return await deps.fetch(
      `${deps.auditEndpoint.replace(/\/$/, '')}/pagespeed?${new URLSearchParams({ domain: params.get('url') ?? '', strategy: params.get('strategy') ?? 'mobile' })}`,
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }
};

type PageSpeedAttemptResult =
  | { success: true; data: PsiResponse; response: Response }
  | { success: false; erro: Error; isDefinitivo: boolean; isLimiteDeUso: boolean };

const formatarErroPageSpeed = (status: number): Error => {
  const isLimiteDeUso = status === 429;
  return new Error(
    isLimiteDeUso
      ? 'Serviço do Google momentaneamente sobrecarregado. Tente novamente em instantes.'
      : 'A medição de velocidade do Google não pôde ser concluída no momento.',
  );
};

const formatarErroDeRede = (erro: unknown): Error => {
  return erro instanceof Error && erro.name === 'AbortError'
    ? new Error('O Google demorou demais para responder a medição de velocidade.')
    : new Error('Não foi possível falar com o PageSpeed Insights do Google.');
};

const tentarBuscarPageSpeed = async (
  params: URLSearchParams,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<PageSpeedAttemptResult> => {
  try {
    const response = await buscarPageSpeed(params, deps);
    const data = (await response.json()) as PsiResponse;

    if (!data.error && response.ok && data.lighthouseResult) {
      return { success: true, data, response };
    }

    if (response.status === 429 && data.code === 'rate_limited') {
      return {
        success: false,
        erro: new Error(MENSAGEM_LIMITE_DO_WORKER),
        isDefinitivo: true,
        isLimiteDeUso: true,
      };
    }

    const status = data.error?.code ?? response.status;
    return {
      success: false,
      erro: formatarErroPageSpeed(status),
      isDefinitivo: isErroDefinitivo(status),
      isLimiteDeUso: status === 429,
    };
  } catch (erro) {
    return {
      success: false,
      erro: formatarErroDeRede(erro),
      isDefinitivo: false,
      isLimiteDeUso: false,
    };
  }
};

const buscarPageSpeedComRetentativas = async (
  params: URLSearchParams,
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<{ data: PsiResponse; response: Response }> => {
  let ultimoErro: Error | null = null;

  for (let tentativa = 1; tentativa <= PAGESPEED_TENTATIVAS; tentativa += 1) {
    const resultado = await tentarBuscarPageSpeed(params, deps);

    if (resultado.success) {
      return { data: resultado.data, response: resultado.response };
    }

    ultimoErro = resultado.erro;

    if (resultado.isDefinitivo) {
      throw ultimoErro;
    }

    if (tentativa < PAGESPEED_TENTATIVAS) {
      await esperar(esperaDaTentativa(tentativa, resultado.isLimiteDeUso));
    }
  }

  throw ultimoErro ?? new Error('O Google não conseguiu analisar este endereço no momento.');
};

const mapearPageSpeedReport = (
  data: PsiResponse,
  strategy: 'mobile' | 'desktop',
): PageSpeedReport => {
  const audits = data.lighthouseResult?.audits ?? {};
  const categories = data.lighthouseResult?.categories ?? {};
  const numeric = (key: string): number | null => audits[key]?.numericValue ?? null;

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

export const fetchPageSpeed = async (
  domain: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
  deps: SourcesDeps = defaultSourcesDeps,
): Promise<PageSpeedReport> => {
  const params = new URLSearchParams({ url: `https://${domain}`, strategy });
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) {
    params.append('category', category);
  }

  const { data } = await buscarPageSpeedComRetentativas(params, deps);
  return mapearPageSpeedReport(data, strategy);
};
