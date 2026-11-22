
import type { AuditCoverage, AuditResult, Finding } from './types';
import { buildSecurityFindings } from './findings/security';
import { buildContentFindings } from './findings/content';
import { buildPerformanceFindings } from './findings/performance';
import { buildDomainFindings } from './findings/domain';

export const buildFindings = (result: AuditResult): Finding[] => {
  const out: Finding[] = [
    ...buildSecurityFindings(result),
    ...buildContentFindings(result),
    ...buildPerformanceFindings(result),
    ...buildDomainFindings(result),
  ];

  const weight = { critical: 0, warning: 1, info: 2, good: 3 } as const;
  return out.sort((a, b) => weight[a.severity] - weight[b.severity]);
};

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
