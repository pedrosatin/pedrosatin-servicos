/**
 * Fontes de dados da auditoria.
 *
 * Todas as chamadas daqui atingem serviços que realmente respondem ao
 * navegador. Nada é simulado: se uma fonte falhar, a função lança e o
 * orquestrador marca a etapa como falha em vez de inventar um valor.
 */

import { AUDIT_ENDPOINT, PAGESPEED_KEY } from './config';
import { getApexDomain } from './dominio';
import type {
  ContentReport,
  DnsReport,
  DomainRegistration,
  EmailAuthReport,
  PageSpeedReport,
} from './types';

// As funções de domínio que não fazem rede moram em `dominio.ts`; ver o
// cabeçalho de lá para o motivo. Continuam saindo por aqui para quem já as
// importava deste arquivo.
export {
  getApexDomain,
  googleIndexUrl,
  isValidDomain,
  normalizeDomain,
  searchConsoleUrl,
} from './dominio';


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

const resolveApexDns = async (domain: string, dns: DnsReport) => {
  if (dns.mx.length > 0) {
    return { activeDns: dns, targetDomain: domain };
  }

  const apex = getApexDomain(domain);
  if (apex === domain) {
    return { activeDns: dns, targetDomain: domain };
  }

  try {
    const apexDns = await fetchDns(apex);
    if (apexDns.mx.length > 0) {
      return { activeDns: apexDns, targetDomain: apex };
    }
  } catch {
    // mantém dns original
  }

  return { activeDns: dns, targetDomain: domain };
};

export const fetchEmailAuth = async (domain: string, dns: DnsReport): Promise<EmailAuthReport> => {
  const { activeDns, targetDomain } = await resolveApexDns(domain, dns);

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
 * O PageSpeed roda um Lighthouse de verdade no servidor do Google, e essa
 * máquina falha com alguma frequência: numa bateria de 24 chamadas seguidas,
 * 7 voltaram com erro — e todas as repetidas passaram na tentativa seguinte,
 * sem nenhuma mudança no alvo. É falha passageira, não problema do site.
 *
 * Daí a distinção abaixo. Repetir só ajuda quando o erro é do lado de lá:
 *
 *  - 500/502/503 e falha de rede: o caso comum, repetir resolve;
 *  - 429: é limite de uso. Repetir rápido piora, então a espera é maior;
 *  - 400/403/404: a resposta não muda na segunda tentativa (endereço inválido,
 *    chave bloqueada). Repetir só faria o visitante esperar o dobro para
 *    receber o mesmo erro.
 */
const PAGESPEED_TENTATIVAS = 3;
const PAGESPEED_TIMEOUT_MS = 60_000;

/** Códigos em que insistir não muda a resposta. */
const isErroDefinitivo = (status: number): boolean =>
  status === 400 || status === 403 || status === 404;

const esperar = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera antes da próxima tentativa: cresce a cada rodada e leva um sorteio.
 * O sorteio existe porque a medição de computador e a de celular saem juntas;
 * sem ele, as duas falhariam e voltariam a bater no Google no mesmo instante.
 */
const esperaDaTentativa = (tentativa: number, foiLimiteDeUso: boolean): number => {
  const base = foiLimiteDeUso ? 5_000 : 1_000;
  return base * 2 ** (tentativa - 1) + Math.random() * 500;
};

/** Uma ida ao PageSpeed, com teto de tempo próprio. */
const buscarPageSpeed = async (params: URLSearchParams): Promise<Response> => {
  // Sem isto, uma resposta que nunca chega deixa a etapa pendurada para sempre.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS);
  try {
    return await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }
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

  let data: PsiResponse | null = null;
  let response: Response | null = null;
  let ultimoErro: Error | null = null;

  for (let tentativa = 1; tentativa <= PAGESPEED_TENTATIVAS; tentativa += 1) {
    let foiLimiteDeUso = false;

    try {
      response = await buscarPageSpeed(params);
      data = (await response.json()) as PsiResponse;

      const status = data.error?.code ?? response.status;

      if (!data.error && response.ok && data.lighthouseResult) break;

      foiLimiteDeUso = status === 429;
      ultimoErro = new Error(
        foiLimiteDeUso
          ? 'Serviço do Google momentaneamente sobrecarregado. Tente novamente em instantes.'
          : 'A medição de velocidade do Google não pôde ser concluída no momento.',
      );

      // Insistir aqui só atrasaria o mesmo erro.
      if (isErroDefinitivo(status)) throw ultimoErro;
    } catch (erro) {
      if (erro === ultimoErro) throw erro;
      // Rede caiu ou o tempo estourou: a resposta sequer chegou.
      ultimoErro =
        erro instanceof Error && erro.name === 'AbortError'
          ? new Error('O Google demorou demais para responder a medição de velocidade.')
          : new Error('Não foi possível falar com o PageSpeed Insights do Google.');
      data = null;
    }

    if (tentativa < PAGESPEED_TENTATIVAS) {
      await esperar(esperaDaTentativa(tentativa, foiLimiteDeUso));
    }
  }

  if (!data?.lighthouseResult || !response?.ok || data.error) {
    throw ultimoErro ?? new Error('O Google não conseguiu analisar este endereço no momento.');
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
