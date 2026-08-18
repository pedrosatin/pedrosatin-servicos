/** Monta a mensagem de WhatsApp a partir do que a auditoria realmente encontrou. */

import { buildWhatsAppUrl } from './config';
import type { AuditResult, Finding } from './types';

export const auditWhatsAppUrl = (result: AuditResult | null, domain?: string): string => {
  if (!result) {
    const target = domain ? ` sobre o site ${domain}` : '';
    return buildWhatsAppUrl(
      `Olá Pedro, vim pelo site de serviços e gostaria de conversar${target}.`,
    );
  }

  const problems = result.findings
    .filter((f) => f.severity === 'critical' || f.severity === 'warning')
    .slice(0, 3);

  const lines = [
    `Olá Pedro, analisei o site ${result.domain} na sua página.`,
    result.score ? `Resultado: ${result.score.value}/100 (${result.score.label}).` : '',
    problems.length > 0 ? `Principais pontos encontrados:` : '',
    ...problems.map((finding, index) => `${index + 1}. ${finding.title}`),
    '',
    'Gostaria de entender o que dá para resolver.',
  ].filter(Boolean);

  return buildWhatsAppUrl(lines.join('\n'));
};

export const findingWhatsAppUrl = (domain: string, finding: Finding): string =>
  buildWhatsAppUrl(
    `Olá Pedro, na análise de ${domain} apareceu este ponto: "${finding.title}". Como funciona a correção?`,
  );

export interface Briefing {
  name: string;
  activity: string;
  need: string;
  currentSite: string;
  notes: string;
}

/**
 * Monta a mensagem do formulário de três passos. Se houver auditoria feita, os
 * achados vão junto, para que o orçamento comece com contexto técnico.
 */
export const briefingWhatsAppUrl = (briefing: Briefing, result: AuditResult | null): string => {
  const lines: string[] = ['Olá Pedro, vim pela sua página de serviços.'];

  if (briefing.name.trim()) lines.push(`Meu nome é ${briefing.name.trim()}.`);
  if (briefing.activity.trim()) lines.push(`Atuo com: ${briefing.activity.trim()}.`);
  if (briefing.need.trim()) lines.push(`Preciso de: ${briefing.need.trim()}.`);

  const site = briefing.currentSite.trim();
  if (site) lines.push(`Site atual: ${site}`);

  if (result && result.domain === site.replace(/^https?:\/\//, '').replace(/\/.*$/, '')) {
    if (result.score) lines.push(`Rodei a análise na sua página: ${result.score.value}/100.`);
    const problems = result.findings
      .filter((f) => f.severity === 'critical' || f.severity === 'warning')
      .slice(0, 3);
    if (problems.length > 0) {
      lines.push('Pontos que apareceram:');
      lines.push(...problems.map((f, i) => `${i + 1}. ${f.title}`));
    }
  }

  if (briefing.notes.trim()) lines.push(`Observações: ${briefing.notes.trim()}`);

  lines.push('', 'Podemos conversar sobre o levantamento e o orçamento?');
  return buildWhatsAppUrl(lines.join('\n'));
};
