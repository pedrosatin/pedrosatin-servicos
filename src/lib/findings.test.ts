import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFindings, scoreFromFindings } from './findings';
import type { AuditResult, Finding } from './types';
import { buildSecurityFindings } from './findings/security';
import { buildContentFindings } from './findings/content';
import { buildPerformanceFindings } from './findings/performance';
import { buildDomainFindings } from './findings/domain';

vi.mock('./findings/security');
vi.mock('./findings/content');
vi.mock('./findings/performance');
vi.mock('./findings/domain');

describe('buildFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call all builders and return sorted findings', () => {
    const dummyResult = {} as unknown as AuditResult;

    vi.mocked(buildSecurityFindings).mockImplementation((_res, push) => {
      push({ id: 'sec-1', severity: 'warning', area: 'seguranca', title: 't', action: 'a', evidence: 'e' });
    });
    vi.mocked(buildContentFindings).mockImplementation((_res, push) => {
      push({ id: 'cont-1', severity: 'good', area: 'conteudo', title: 't', action: 'a', evidence: 'e' });
      push({ id: 'cont-2', severity: 'info', area: 'conteudo', title: 't', action: 'a', evidence: 'e' });
    });
    vi.mocked(buildPerformanceFindings).mockImplementation((_res, push) => {
      push({ id: 'perf-1', severity: 'critical', area: 'desempenho', title: 't', action: 'a', evidence: 'e' });
    });
    vi.mocked(buildDomainFindings).mockImplementation((_res, _push) => {
       // Does not push anything for this test
    });

    const findings = buildFindings(dummyResult);

    expect(buildSecurityFindings).toHaveBeenCalledWith(dummyResult, expect.any(Function));
    expect(buildContentFindings).toHaveBeenCalledWith(dummyResult, expect.any(Function));
    expect(buildPerformanceFindings).toHaveBeenCalledWith(dummyResult, expect.any(Function));
    expect(buildDomainFindings).toHaveBeenCalledWith(dummyResult, expect.any(Function));

    expect(findings).toHaveLength(4);
    expect(findings[0]?.severity).toBe('critical'); // perf-1
    expect(findings[1]?.severity).toBe('warning'); // sec-1
    expect(findings[2]?.severity).toBe('info'); // cont-2
    expect(findings[3]?.severity).toBe('good'); // cont-1
  });
});

describe('scoreFromFindings', () => {
  it('returns null if coverage is incomplete', () => {
    expect(scoreFromFindings([], { complete: false, missing: [] })).toBeNull();
  });

  it('returns score if coverage is missing or complete', () => {
    expect(scoreFromFindings([])).toEqual({ value: 100, label: 'Bem resolvido' });
    expect(scoreFromFindings([], { complete: true, missing: [] })).toEqual({ value: 100, label: 'Bem resolvido' });
  });

  it('calculates score and labels correctly based on findings penalties', () => {
    const createFinding = (severity: Finding['severity']): Finding => ({
       id: 'x', area: 'conteudo', title: 'x', evidence: 'x', action: 'x', severity
    });

    // 100 - 0 = 100 (Bem resolvido)
    expect(scoreFromFindings([createFinding('good')])).toEqual({ value: 100, label: 'Bem resolvido' });

    // 100 - 15 = 85 (Bem resolvido)
    expect(scoreFromFindings([createFinding('critical')])).toEqual({ value: 85, label: 'Bem resolvido' });

    // 100 - 15 - 6 - 1.5 = 77.5 -> round -> 78 (Ajustes pontuais)
    expect(scoreFromFindings([
        createFinding('critical'),
        createFinding('warning'),
        createFinding('info')
    ])).toEqual({ value: 78, label: 'Ajustes pontuais' });

    // 100 - 15*4 = 40 (Precisa de atenção)
    expect(scoreFromFindings([
        createFinding('critical'), createFinding('critical'),
        createFinding('critical'), createFinding('critical')
    ])).toEqual({ value: 40, label: 'Precisa de atenção' });

    // 100 - 15*5 = 25 (Situação crítica)
    expect(scoreFromFindings([
        createFinding('critical'), createFinding('critical'),
        createFinding('critical'), createFinding('critical'),
        createFinding('critical')
    ])).toEqual({ value: 25, label: 'Situação crítica' });

    // Clamp to 0
    expect(scoreFromFindings([
        createFinding('critical'), createFinding('critical'),
        createFinding('critical'), createFinding('critical'),
        createFinding('critical'), createFinding('critical'),
        createFinding('critical'), createFinding('critical')
    ])).toEqual({ value: 0, label: 'Situação crítica' });
  });
});
