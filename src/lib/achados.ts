
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
