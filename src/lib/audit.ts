/**
 * Orquestrador da auditoria.
 *
 * Executa as fontes em paralelo quando possível e informa o progresso etapa a
 * etapa, o que permite à página exibir o andamento real da análise em vez de
 * uma barra de carregamento decorativa.
 */

import { buildFindings, scoreFromFindings } from './findings';
import {
  fetchContent,
  fetchDns,
  fetchEmailAuth,
  fetchPageSpeed,
  fetchRegistration,
} from './sources';
import { isValidDomain, normalizeDomain } from './dominio';
import type { AuditResult, AuditStep } from './types';

export const createSteps = (domain: string): AuditStep[] => [
  {
    id: 'dns',
    label: 'Resolvendo DNS',
    command: `dig ${domain} A NS MX TXT`,
    status: 'pending',
    detail: null,
    durationMs: null,
  },
  {
    id: 'registro',
    label: 'Consultando registro do domínio',
    command: `rdap ${domain}`,
    status: 'pending',
    detail: null,
    durationMs: null,
  },
  {
    id: 'email',
    label: 'Verificando SPF e DMARC',
    command: `dig _dmarc.${domain} TXT`,
    status: 'pending',
    detail: null,
    durationMs: null,
  },
  {
    id: 'conteudo',
    label: 'Analisando HTML, robots.txt e sitemap',
    command: `audit --html --robots --sitemap https://${domain}`,
    status: 'pending',
    detail: null,
    durationMs: null,
  },
  {
    id: 'pagespeed',
    label: 'Medindo com o PageSpeed Insights do Google',
    command: `pagespeed --strategy=mobile https://${domain}`,
    status: 'pending',
    detail: null,
    durationMs: null,
  },
];

export interface AuditOptions {
  onStep?: (step: AuditStep) => void;
  strategy?: 'mobile' | 'desktop';
  /** O PageSpeed leva de 15 a 40 segundos; pode ser desligado em telas rápidas. */
  includePageSpeed?: boolean;
}

const runStep = async <T,>(
  id: string,
  label: string,
  command: string,
  task: () => Promise<T>,
  describe: (value: T) => string,
  onStep?: (step: AuditStep) => void,
): Promise<{ value: T | null; error: string | null }> => {
  const started = Date.now();
  onStep?.({ id, label, command, status: 'running', detail: null, durationMs: null });

  try {
    const value = await task();
    onStep?.({
      id,
      label,
      command,
      status: 'done',
      detail: describe(value),
      durationMs: Date.now() - started,
    });
    return { value, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada.';
    onStep?.({
      id,
      label,
      command,
      status: 'failed',
      detail: message,
      durationMs: Date.now() - started,
    });
    return { value: null, error: message };
  }
};

export const runAudit = async (
  rawInput: string,
  options: AuditOptions = {},
): Promise<AuditResult> => {
  const domain = normalizeDomain(rawInput);
  const { onStep, strategy = 'mobile', includePageSpeed = true } = options;

  if (!isValidDomain(domain)) {
    throw new Error('Endereço inválido. Use o formato exemplo.com.br');
  }

  const startedAt = new Date().toISOString();
  const steps = createSteps(domain);
  const stepOf = (id: string): AuditStep => steps.find((s) => s.id === id) as AuditStep;

  const dnsStep = stepOf('dns');
  const dnsOutcome = await runStep(
    dnsStep.id,
    dnsStep.label,
    dnsStep.command,
    () => fetchDns(domain),
    (dns) =>
      dns.resolves
        ? `${dns.a.length} registro(s) A${dns.hosting ? ` · ${dns.hosting}` : ''}${dns.mx.length ? ` · ${dns.mx.length} MX` : ' · sem MX'}`
        : 'O domínio não resolve para nenhum endereço IP.',
    onStep,
  );
  const dns = dnsOutcome.value;

  const registroStep = stepOf('registro');
  const emailStep = stepOf('email');
  const conteudoStep = stepOf('conteudo');

  const [registrationOutcome, emailOutcome, contentOutcome] = await Promise.all([
    runStep(
      registroStep.id,
      registroStep.label,
      registroStep.command,
      () => fetchRegistration(domain),
      (registration) =>
        registration.found
          ? `${registration.registrar ?? 'registrador não informado'}${registration.expiresAt ? ` · vence em ${new Date(registration.expiresAt).toLocaleDateString('pt-BR')}` : ''}`
          : 'Domínio não consta como registrado.',
      onStep,
    ),
    dns
      ? runStep(
          emailStep.id,
          emailStep.label,
          emailStep.command,
          () => fetchEmailAuth(domain, dns),
          (email) =>
            email.hasMx
              ? `SPF ${email.spf ? 'presente' : 'ausente'} · DMARC ${email.dmarc ? `p=${email.dmarcPolicy ?? '?'}` : 'ausente'}`
              : 'O domínio não recebe e-mails.',
          onStep,
        )
      : Promise.resolve({ value: null, error: 'DNS indisponível.' }),
    runStep(
      conteudoStep.id,
      conteudoStep.label,
      conteudoStep.command,
      () => fetchContent(domain),
      (content) =>
        `HTTP ${content.status}${content.html?.platform ? ` · ${content.html.platform}` : ''} · ${content.html?.wordCount ?? 0} palavras no HTML`,
      onStep,
    ),
  ]);

  const pagespeedStep = stepOf('pagespeed');
  const pagespeedOutcome = includePageSpeed
    ? await runStep(
        pagespeedStep.id,
        pagespeedStep.label,
        pagespeedStep.command,
        () => fetchPageSpeed(domain, strategy),
        (report) =>
          `desempenho ${report.scores.performance ?? '—'}/100 · SEO ${report.scores.seo ?? '—'}/100${report.field.available ? ' · com dados de usuários reais' : ' · sem amostra de campo'}`,
        onStep,
      )
    : (onStep?.({ ...pagespeedStep, status: 'skipped' }), { value: null, error: null });

  // Uma fonte que falha não pode passar por "nada encontrado". O PageSpeed
  // desligado de propósito é outra coisa: reduz o alcance sem invalidá-lo.
  const missing: string[] = [];
  if (!dns) missing.push('resolução de DNS');
  if (contentOutcome.error) missing.push('leitura do HTML, robots.txt e sitemap');
  if (includePageSpeed && pagespeedOutcome.error) missing.push('medição do Google (PageSpeed)');

  const coverage = { complete: missing.length === 0, missing };

  const partial: AuditResult = {
    domain,
    startedAt,
    finishedAt: new Date().toISOString(),
    coverage,
    dns,
    email: emailOutcome.value,
    registration: registrationOutcome.value,
    content: contentOutcome.value,
    pagespeed: pagespeedOutcome.value,
    pagespeedError: pagespeedOutcome.error,
    contentError: contentOutcome.error,
    findings: [],
    score: null,
  };

  const findings = buildFindings(partial);
  return { ...partial, findings, score: scoreFromFindings(findings, coverage) };
};
