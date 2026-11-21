import { describe, it, expect } from 'vitest';
import { buildPerformanceFindings } from './performance';
import type { AuditResult } from '../types';

describe('buildPerformanceFindings', () => {

  const createBaseResult = (): any => ({
    pagespeed: {
      strategy: 'mobile',
      field: {
        available: true,
        origin: false,
        lcp: { p75: null },
        cls: { p75: null },
        inp: { p75: null }
      },
      lab: {
        lcpMs: null,
        serverResponseMs: null,
        totalBytes: null
      },
      scores: {
        performance: null,
        seo: null,
        accessibility: null
      }
    }
  });

  describe('no pagespeed data', () => {
    it('does nothing if pagespeed is null', () => {
      const result = { pagespeed: null } as unknown as AuditResult;
      const findings = buildPerformanceFindings(result);
      expect(findings).toEqual([]);
    });

    it('does nothing if pagespeed is undefined', () => {
      const result = {} as unknown as AuditResult;
      const findings = buildPerformanceFindings(result);
      expect(findings).toEqual([]);
    });
  });

  describe('LCP (lcp-campo / sem-dados-campo)', () => {
    it('pushes lcp-campo critical when lcp > 4000', () => {
      const result = createBaseResult();
      result.pagespeed.field.lcp.p75 = 4500;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'lcp-campo',
        severity: 'critical',
        evidence: '4.50 s no percentil 75 de usuários reais do Chrome. O limite do Google é 2.50 s.',
      }));
    });

    it('pushes lcp-campo warning when 2500 < lcp <= 4000', () => {
      const result = createBaseResult();
      result.pagespeed.field.lcp.p75 = 3000;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'lcp-campo',
        severity: 'warning',
      }));
    });

    it('pushes lcp-campo good when lcp <= 2500', () => {
      const result = createBaseResult();
      result.pagespeed.field.lcp.p75 = 2000;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'lcp-campo',
        severity: 'good',
      }));
    });

    it('includes origin domain info in evidence when field.origin is true', () => {
      const result = createBaseResult();
      result.pagespeed.field.lcp.p75 = 2000;
      result.pagespeed.field.origin = true;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'lcp-campo',
        evidence: expect.stringContaining('(dados de todo o domínio)')
      }));
    });

    it('does not include origin domain info in evidence when field.origin is false', () => {
      const result = createBaseResult();
      result.pagespeed.field.lcp.p75 = 2000;
      result.pagespeed.field.origin = false;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).not.toContainEqual(expect.objectContaining({
        id: 'lcp-campo',
        evidence: expect.stringContaining('(dados de todo o domínio)')
      }));
    });

    it('pushes sem-dados-campo when field is not available', () => {
      const result = createBaseResult();
      result.pagespeed.field.available = false;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'sem-dados-campo',
        severity: 'info',
      }));
    });
  });

  describe('CLS (cls-campo)', () => {
    it('pushes cls-campo critical when cls > 0.25', () => {
      const result = createBaseResult();
      result.pagespeed.field.cls.p75 = 0.3;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'cls-campo',
        severity: 'critical'
      }));
    });

    it('pushes cls-campo warning when 0.1 < cls <= 0.25', () => {
      const result = createBaseResult();
      result.pagespeed.field.cls.p75 = 0.2;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'cls-campo',
        severity: 'warning'
      }));
    });

    it('does not push cls-campo when cls <= 0.1', () => {
      const result = createBaseResult();
      result.pagespeed.field.cls.p75 = 0.05;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).not.toContainEqual(expect.objectContaining({
        id: 'cls-campo'
      }));
    });
  });

  describe('INP (inp-campo)', () => {
    it('pushes inp-campo critical when inp > 500', () => {
      const result = createBaseResult();
      result.pagespeed.field.inp.p75 = 600;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'inp-campo',
        severity: 'critical',
        evidence: '600 ms entre o toque e a resposta visual; o limite do Google é 200 ms.',
      }));
    });

    it('pushes inp-campo warning when 200 < inp <= 500', () => {
      const result = createBaseResult();
      result.pagespeed.field.inp.p75 = 300;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'inp-campo',
        severity: 'warning',
        evidence: expect.stringContaining('300 ms'),
      }));
    });

    it('does not push inp-campo when inp <= 200', () => {
      const result = createBaseResult();
      result.pagespeed.field.inp.p75 = 150;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).not.toContainEqual(expect.objectContaining({
        id: 'inp-campo'
      }));
    });
  });

  describe('Performance Score (score-performance)', () => {
    it('pushes critical when score < 50', () => {
      const result = createBaseResult();
      result.pagespeed.scores.performance = 40;
      result.pagespeed.lab.lcpMs = 3200;
      result.pagespeed.lab.serverResponseMs = 450;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-performance',
        severity: 'critical',
        evidence: 'Medição do Lighthouse: maior elemento em 3.20 s, resposta do servidor em 450 ms.',
      }));
    });

    it('pushes warning when 50 <= score < 90', () => {
      const result = createBaseResult();
      result.pagespeed.scores.performance = 80;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-performance',
        severity: 'warning'
      }));
    });

    it('pushes good when score >= 90', () => {
      const result = createBaseResult();
      result.pagespeed.scores.performance = 95;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-performance',
        severity: 'good'
      }));
    });

    it('includes "celular" in title if strategy is mobile', () => {
      const result = createBaseResult();
      result.pagespeed.strategy = 'mobile';
      result.pagespeed.scores.performance = 95;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-performance',
        title: expect.stringContaining('celular')
      }));
    });

    it('includes "computador" in title if strategy is desktop', () => {
      const result = createBaseResult();
      result.pagespeed.strategy = 'desktop';
      result.pagespeed.scores.performance = 95;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-performance',
        title: expect.stringContaining('computador')
      }));
    });
  });

  describe('SEO Score (score-seo)', () => {
    it('pushes warning when score < 70', () => {
      const result = createBaseResult();
      result.pagespeed.scores.seo = 60;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-seo',
        severity: 'warning'
      }));
    });

    it('pushes info when 70 <= score < 90', () => {
      const result = createBaseResult();
      result.pagespeed.scores.seo = 80;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-seo',
        severity: 'info'
      }));
    });

    it('does not push score-seo when score >= 90', () => {
      const result = createBaseResult();
      result.pagespeed.scores.seo = 95;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).not.toContainEqual(expect.objectContaining({
        id: 'score-seo'
      }));
    });
  });

  describe('Accessibility Score (score-acessibilidade)', () => {
    it('pushes warning when score < 70', () => {
      const result = createBaseResult();
      result.pagespeed.scores.accessibility = 60;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-acessibilidade',
        severity: 'warning'
      }));
    });

    it('pushes info when 70 <= score < 90', () => {
      const result = createBaseResult();
      result.pagespeed.scores.accessibility = 80;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'score-acessibilidade',
        severity: 'info'
      }));
    });

    it('does not push score-acessibilidade when score >= 90', () => {
      const result = createBaseResult();
      result.pagespeed.scores.accessibility = 95;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).not.toContainEqual(expect.objectContaining({
        id: 'score-acessibilidade'
      }));
    });
  });

  describe('Total Bytes (peso-total)', () => {
    it('pushes warning when totalBytes > 2000000', () => {
      const result = createBaseResult();
      result.pagespeed.lab.totalBytes = 2500000;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).toContainEqual(expect.objectContaining({
        id: 'peso-total',
        severity: 'warning',
        evidence: expect.stringContaining('2.4 MB'),
      }));
    });

    it('does not push peso-total when totalBytes <= 2000000', () => {
      const result = createBaseResult();
      result.pagespeed.lab.totalBytes = 1500000;
      const findings = buildPerformanceFindings(result as unknown as AuditResult);
      expect(findings).not.toContainEqual(expect.objectContaining({
        id: 'peso-total'
      }));
    });
  });
});
