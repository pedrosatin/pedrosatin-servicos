
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
  source: 'registro.br' | 'rdap.org' | null;
}

export interface FieldMetric {
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
  field: {
    available: boolean;
    overall: 'FAST' | 'AVERAGE' | 'SLOW' | null;
    lcp: FieldMetric;
    cls: FieldMetric;
    inp: FieldMetric;
    origin: boolean;
  };
  screenshot: string | null;
  screenshotSize: { width: number; height: number } | null;
  opportunities: { title: string; savingsMs: number }[];
  fetchedAt: string;
}

export type { HtmlReport } from '../../shared/report-types';
export type { AuditResponse as ContentReport } from '../../shared/report-types';

export type Severity = 'critical' | 'warning' | 'good' | 'info';

export type FindingArea = 'indexacao' | 'desempenho' | 'mobile' | 'seguranca' | 'dominio' | 'conteudo';

export interface Finding {
  id: string;
  area: FindingArea;
  severity: Severity;
  title: string;
  evidence: string;
  action: string;
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface AuditStep {
  id: string;
  label: string;
  command: string;
  status: StepStatus;
  detail: string | null;
  durationMs: number | null;
}

export interface AuditCoverage {
  complete: boolean;
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
