/** Tipos compartilhados pelo motor de auditoria. */

import type { AuditResponse as ContentReport } from '../../shared/report-types';

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

/**
 * O payload de auditoria (`HtmlReport`, `ContentReport` e suas partes) tem uma
 * fonte única em `shared/report-types.ts`, consumida também pelo Worker. Mudar
 * um campo lá quebra o `typecheck` dos dois lados. `ContentReport` é o nome do
 * front para o `AuditResponse` que o Worker devolve.
 */
export type {
  HtmlReport,
  ImageStats,
  ScriptStats,
  RobotsReport,
  RedirectHop,
  SecurityHeaders,
  SitemapReport,
} from '../../shared/report-types';
export type { AuditResponse as ContentReport } from '../../shared/report-types';

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
  /** Comando equivalente, exibido na página com estética de terminal. */
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
