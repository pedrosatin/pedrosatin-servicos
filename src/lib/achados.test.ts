import { describe, it, expect } from 'vitest';
import { countBySeverity } from './achados';
import type { Finding } from './types';

describe('countBySeverity', () => {
  it('returns zeros for an empty array of findings', () => {
    const findings: Finding[] = [];
    const result = countBySeverity(findings);
    expect(result).toEqual({
      critical: 0,
      warning: 0,
      info: 0,
      good: 0,
    });
  });

  it('correctly counts occurrences of each severity', () => {
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
