import type { AuditCoverage, AuditResult, Finding } from '../types';
import { analyzeSecurity } from './security';
import { analyzeSeo } from './seo';
import { analyzePerformance } from './performance';
import { analyzeDomain } from './domain';

export { AREA_LABELS, countBySeverity } from '../achados';

export const buildFindings = (result: AuditResult): Finding[] => {
  const out: Finding[] = [];
  const push = (finding: Finding): void => {
    out.push(finding);
  };

  analyzeSecurity(result, push);
  analyzeSeo(result, push);
  analyzePerformance(result, push);
  analyzeDomain(result, push);

  const weight = { critical: 0, warning: 1, info: 2, good: 3 } as const;
  return out.sort((a, b) => weight[a.severity] - weight[b.severity]);
};

/**
 * A nota só existe quando as fontes essenciais responderam. Se a leitura do
 * HTML ou a medição do Google falharem, não há base para pontuar: a ausência de
 * defeitos encontrados significaria apenas que nada foi olhado.
 */
export const scoreFromFindings = (
  findings: Finding[],
  coverage?: AuditCoverage,
): { value: number; label: string } | null => {
  if (coverage && !coverage.complete) return null;

  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'critical') return total + 15;
    if (finding.severity === 'warning') return total + 6;
    if (finding.severity === 'info') return total + 1.5;
    return total;
  }, 0);

  const value = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const label =
    value >= 85 ? 'Bem resolvido' : value >= 65 ? 'Ajustes pontuais' : value >= 40 ? 'Precisa de atenção' : 'Situação crítica';

  return { value, label };
};
