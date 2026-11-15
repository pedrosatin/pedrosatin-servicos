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

export const countBySeverity = (findings: Finding[]) => {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity]++;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, good: 0 }
  );
};

/**
 * Agrupa os achados por área, na ordem em que cada área aparece pela primeira
 * vez. A ordem dos achados dentro de cada grupo é a da lista original.
 */
export const groupByArea = (findings: Finding[]): Array<[Finding['area'], Finding[]]> => {
  const groups: Array<[Finding['area'], Finding[]]> = [];
  const map = new Map<Finding['area'], Finding[]>();
  for (const finding of findings) {
    const list = map.get(finding.area);
    if (list === undefined) {
      const nova = [finding];
      map.set(finding.area, nova);
      groups.push([finding.area, nova]);
    } else {
      list.push(finding);
    }
  }
  return groups;
};
