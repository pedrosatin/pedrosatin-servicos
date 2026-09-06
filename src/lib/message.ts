/** Monta a mensagem de WhatsApp a partir do que a auditoria realmente encontrou. */

import { buildWhatsAppUrl } from './config';
import { normalizeDomain } from './dominio';
import type { AuditResult } from './types';

export const auditWhatsAppUrl = (result: AuditResult | null, domain?: string): string => {
  if (!result) {
    const target = domain ? ` sobre o projeto ${domain}` : '';
    return buildWhatsAppUrl(
      `Olá Pedro, vim pela sua página de serviços e gostaria de conversar sobre meu projeto${target}.`,
    );
  }

  const problems = result.findings
    .filter((f) => f.severity === 'critical' || f.severity === 'warning')
    .slice(0, 3);

  const lines = [
    `Olá Pedro, analisei o projeto ${result.domain} na sua página.`,
    result.score ? `Resultado da análise: ${result.score.value}/100 (${result.score.label}).` : '',
    problems.length > 0 ? `Principais pontos encontrados:` : '',
    ...problems.map((finding, index) => `${index + 1}. ${finding.title}`),
    '',
    'Gostaria de entender como podemos resolver e colocar em produção.',
  ].filter(Boolean);

  return buildWhatsAppUrl(lines.join('\n'));
};

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
  const lines: string[] = ['Olá Pedro, vim pela sua página de engenharia para projetos com IA.'];

  if (briefing.name.trim()) lines.push(`Meu nome é ${briefing.name.trim()}.`);
  if (briefing.activity.trim()) lines.push(`Projeto / Atividade: ${briefing.activity.trim()}.`);
  if (briefing.need.trim()) lines.push(`Necessidade: ${briefing.need.trim()}.`);

  const site = briefing.currentSite.trim();
  if (site) lines.push(`Link / Site atual: ${site}`);

  if (result && result.domain === normalizeDomain(site)) {
    if (result.score) lines.push(`Resultado do diagnóstico: ${result.score.value}/100.`);
    const problems = result.findings
      .filter((f) => f.severity === 'critical' || f.severity === 'warning')
      .slice(0, 3);
    if (problems.length > 0) {
      lines.push('Pontos encontrados na análise:');
      lines.push(...problems.map((f, i) => `${i + 1}. ${f.title}`));
    }
  }

  if (briefing.notes.trim()) lines.push(`Detalhes (ferramenta, erros, integrações): ${briefing.notes.trim()}`);

  lines.push('', 'Podemos conversar sobre o levantamento técnico e o orçamento?');
  return buildWhatsAppUrl(lines.join('\n'));
};
