/** Tipos compartilhados pelo motor de auditoria. */

export interface DnsRecord {
  name: string;
  type: number;
  data: string;
  ttl: number;
}

export interface DnsReport {
  domain: string;
  resolves: boolean;
  a: string[];
  aaaa: string[];
  ns: string[];
  mx: string[];
  txt: string[];
  cname: string[];
  /** Provedor deduzido a partir dos nameservers e do CNAME. */
  hosting: string | null;
  dnsProvider: string | null;
}

export interface EmailAuthReport {
  hasMx: boolean;
  mxProvider: string | null;
  spf: string | null;
  dmarc: string | null;
  dmarcPolicy: 'none' | 'quarantine' | 'reject' | null;
}

export interface DomainRegistration {
  found: boolean;
  domain: string;
  registrar: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  changedAt: string | null;
  daysToExpire: number | null;
  status: string[];
  nameservers: string[];
  dnssec: boolean;
  /** Registro.br quando for domínio .br; caso contrário o RDAP genérico. */
  source: 'registro.br' | 'rdap.org' | null;
}

export interface FieldMetric {
  /** Percentil 75 observado em usuários reais do Chrome. */
  p75: number | null;
  category: 'FAST' | 'AVERAGE' | 'SLOW' | null;
}

export interface PageSpeedReport {
  strategy: 'mobile' | 'desktop';
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  lab: {
    lcpMs: number | null;
    fcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
    speedIndexMs: number | null;
    serverResponseMs: number | null;
    totalBytes: number | null;
  };
  /** Dados de campo do CrUX: usuários reais, não simulação. */
  field: {
    available: boolean;
    overall: 'FAST' | 'AVERAGE' | 'SLOW' | null;
    lcp: FieldMetric;
    cls: FieldMetric;
    inp: FieldMetric;
    origin: boolean;
  };
  screenshot: string | null;
  /** Dimensões da captura, quando o Lighthouse as informa. */
  screenshotSize: { width: number; height: number } | null;
  opportunities: { title: string; savingsMs: number }[];
  fetchedAt: string;
}

export interface HtmlReport {
  bytes: number;
  lang: string | null;
  charset: string | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  h1: string[];
  h2Count: number;
  images: { total: number; withoutAlt: number; withoutDimensions: number; lazy: number };
  openGraph: { title: string | null; description: string | null; image: string | null };
  twitterCard: string | null;
  jsonLdTypes: string[];
  favicon: boolean;
  scripts: { total: number; blocking: number; external: number };
  stylesheets: number;
  inlineStyleBytes: number;
  generator: string | null;
  hreflang: string[];
  wordCount: number;
  platform: string | null;
}

export interface ContentReport {
  ok: boolean;
  error?: string;
  input: string;
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirects: { url: string; status: number; location: string | null }[];
  servedOverHttps: boolean;
  httpRedirectsToHttps: boolean | null;
  edgeResponseMs: number;
  server: string | null;
  poweredBy: string | null;
  cacheControl: string | null;
  contentEncoding: string | null;
  compressed: boolean;
  securityHeaders: {
    hsts: string | null;
    contentTypeOptions: string | null;
    frameOptions: string | null;
    csp: string | null;
    referrerPolicy: string | null;
    permissionsPolicy: string | null;
  };
  html: HtmlReport | null;
  robots: { found: boolean; blocksAll: boolean; sitemaps: string[] } | null;
  sitemap: { found: boolean; url: string | null; urlCount: number | null; isIndex: boolean };
  checkedAt: string;
}

export type Severity = 'critical' | 'warning' | 'good' | 'info';

export type FindingArea = 'indexacao' | 'desempenho' | 'mobile' | 'seguranca' | 'dominio' | 'conteudo';

export interface Finding {
  id: string;
  area: FindingArea;
  severity: Severity;
  title: string;
  /** Evidência textual do que foi medido — nunca uma afirmação genérica. */
  evidence: string;
  /** O que fazer a respeito. */
  action: string;
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface AuditStep {
  id: string;
  label: string;
  /** Comando equivalente, exibido nos protótipos com estética de terminal. */
  command: string;
  status: StepStatus;
  detail: string | null;
  durationMs: number | null;
}

/**
 * Quais fontes essenciais responderam. Sem isso, uma análise em que tudo
 * falhou produziria nota alta apenas por não ter encontrado defeitos.
 */
export interface AuditCoverage {
  complete: boolean;
  /** Descrição legível do que não pôde ser medido. */
  missing: string[];
}

export interface AuditResult {
  domain: string;
  startedAt: string;
  finishedAt: string | null;
  coverage: AuditCoverage;
  dns: DnsReport | null;
  email: EmailAuthReport | null;
  registration: DomainRegistration | null;
  content: ContentReport | null;
  pagespeed: PageSpeedReport | null;
  pagespeedError: string | null;
  contentError: string | null;
  findings: Finding[];
  score: { value: number; label: string } | null;
}
