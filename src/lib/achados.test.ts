import { describe, it, expect } from 'vitest';
import { countBySeverity, groupByArea } from './achados';
import type { Finding } from './types';

describe('countBySeverity', () => {
  it('returns zeroes for empty findings array', () => {
    const findings: Finding[] = [];
    const result = countBySeverity(findings);
    expect(result).toEqual({
      critical: 0,
      warning: 0,
      info: 0,
      good: 0,
    });
  });

  it('counts findings with different severities correctly', () => {
    const findings: Finding[] = [
      { id: '1', severity: 'critical', title: '1', evidence: '', action: '', area: 'conteudo' },
      { id: '2', severity: 'critical', title: '2', evidence: '', action: '', area: 'conteudo' },
      { id: '3', severity: 'warning', title: '3', evidence: '', action: '', area: 'conteudo' },
      { id: '4', severity: 'info', title: '4', evidence: '', action: '', area: 'conteudo' },
      { id: '5', severity: 'good', title: '5', evidence: '', action: '', area: 'conteudo' },
      { id: '6', severity: 'good', title: '6', evidence: '', action: '', area: 'conteudo' },
      { id: '7', severity: 'good', title: '7', evidence: '', action: '', area: 'conteudo' },
    ];
    const result = countBySeverity(findings);
    expect(result).toEqual({
      critical: 2,
      warning: 1,
      info: 1,
      good: 3,
    });
  });

  it('handles missing severities correctly', () => {
    const findings: Finding[] = [
      { id: '1', severity: 'warning', title: '1', evidence: '', action: '', area: 'conteudo' },
      { id: '2', severity: 'info', title: '2', evidence: '', action: '', area: 'conteudo' },
    ];
    const result = countBySeverity(findings);
    expect(result).toEqual({
      critical: 0,
      warning: 1,
      info: 1,
      good: 0,
    });
  });
});

describe('groupByArea', () => {
  const achado = (id: string, area: Finding['area']): Finding => ({
    id,
    severity: 'info',
    title: id,
    evidence: '',
    action: '',
    area,
  });

  it('devolve lista vazia sem achados', () => {
    expect(groupByArea([])).toEqual([]);
  });

  it('mantém a ordem de primeira aparição das áreas e a dos achados em cada uma', () => {
    const findings = [
      achado('1', 'desempenho'),
      achado('2', 'seguranca'),
      achado('3', 'desempenho'),
      achado('4', 'dominio'),
      achado('5', 'seguranca'),
    ];

    const grupos = groupByArea(findings);

    expect(grupos.map(([area]) => area)).toEqual(['desempenho', 'seguranca', 'dominio']);
    expect(grupos.map(([, lista]) => lista.map((f) => f.id))).toEqual([
      ['1', '3'],
      ['2', '5'],
      ['4'],
    ]);
  });
});
