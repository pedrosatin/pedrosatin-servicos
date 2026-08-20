/**
 * O rótulo e a contagem dos achados, separados das regras que os produzem.
 *
 * A página monta o resumo por severidade e os títulos de seção assim que abre,
 * enquanto `buildFindings` — que são seiscentas linhas de regras — só roda
 * quando a análise termina. Mantê-los no mesmo arquivo levava todas as regras
 * para o pacote inicial. Ver o mesmo raciocínio em `dominio.ts`.
 */

import type { Finding } from './types';

export const AREA_LABELS: Record<Finding['area'], string> = {
  indexacao: 'Indexação no Google',
  desempenho: 'Desempenho',
  mobile: 'Celular',
  seguranca: 'Segurança',
  dominio: 'Domínio',
  conteudo: 'Conteúdo',
};

export const countBySeverity = (findings: Finding[]) => ({
  critical: findings.filter((f) => f.severity === 'critical').length,
  warning: findings.filter((f) => f.severity === 'warning').length,
  info: findings.filter((f) => f.severity === 'info').length,
  good: findings.filter((f) => f.severity === 'good').length,
});
