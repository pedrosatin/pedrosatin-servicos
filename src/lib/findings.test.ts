import { describe, it, expect } from 'vitest';
import { buildFindings, scoreFromFindings } from './findings';
import type { AuditResult, Finding } from './types';

const resultadoMultiArea = (): AuditResult =>
  ({
    domain: 'example.com',
    content: {
      servedOverHttps: true,
      httpRedirectsToHttps: false,
      securityHeaders: { hsts: false },
      cacheControl: 'max-age=3600',
      compressed: true,
      redirects: [],
      robots: { blocksAll: true },
      sitemap: { found: false },
    },
    pagespeed: {
      strategy: 'mobile',
      field: {
        available: true,
        origin: false,
        lcp: { p75: 4500 },
        cls: { p75: null },
        inp: { p75: null },
      },
      lab: {
        lcpMs: null,
        serverResponseMs: null,
        totalBytes: null,
      },
      scores: {
        performance: null,
        seo: null,
        accessibility: null,
      },
    },
    registration: {
      found: true,
      daysToExpire: 150,
      expiresAt: '2023-06-01T12:00:00.000Z',
      registeredAt: '2022-06-01T12:00:00.000Z',
      dnssec: true,
      source: 'registro.br',
    },
  }) as unknown as AuditResult;

const resultadoVazio = (): AuditResult => ({} as unknown as AuditResult);

describe('buildFindings', () => {
  it('concatena builders reais, ordena por severidade e preserva a ordem estável', () => {
    const findings = buildFindings(resultadoMultiArea());
    const ids = findings.map((finding) => finding.id);
    const severities = findings.map((finding) => finding.severity);

    expect(ids).toEqual([
      'robots-bloqueia',
      'lcp-campo',
      'http-sem-redirect',
      'sitemap-ausente',
      'sem-hsts',
      'dominio-ok',
    ]);
    expect(severities).toEqual([
      'critical',
      'critical',
      'warning',
      'warning',
      'info',
      'good',
    ]);
  });

  it('devolve lista vazia quando o resultado não tem dados coletados', () => {
    expect(buildFindings(resultadoVazio())).toEqual([]);
  });
});

describe('scoreFromFindings', () => {
  it('aplica as penalidades sobre os achados reais do orquestrador', () => {
    const findings = buildFindings(resultadoMultiArea());
    expect(scoreFromFindings(findings, { complete: true, missing: [] })).toEqual({
      value: 57,
      label: 'Precisa de atenção',
    });
  });

  it('devolve null quando a cobertura está incompleta', () => {
    expect(scoreFromFindings([], { complete: false, missing: ['HTML'] })).toBeNull();
    expect(
      scoreFromFindings(buildFindings(resultadoMultiArea()), {
        complete: false,
        missing: ['medição do Google (PageSpeed)'],
      }),
    ).toBeNull();
  });

  it('devolve nota 100 com lista vazia e cobertura completa ou omitida', () => {
    expect(scoreFromFindings(buildFindings(resultadoVazio()))).toEqual({
      value: 100,
      label: 'Bem resolvido',
    });
    expect(scoreFromFindings([], { complete: true, missing: [] })).toEqual({
      value: 100,
      label: 'Bem resolvido',
    });
  });

  it('calcula rótulos e limites pelas penalidades 15 / 6 / 1.5', () => {
    const createFinding = (severity: Finding['severity']): Finding => ({
      id: 'x',
      area: 'conteudo',
      title: 'x',
      evidence: 'x',
      action: 'x',
      severity,
    });

    expect(scoreFromFindings([createFinding('good')])).toEqual({
      value: 100,
      label: 'Bem resolvido',
    });
    expect(scoreFromFindings([createFinding('critical')])).toEqual({
      value: 85,
      label: 'Bem resolvido',
    });
    expect(
      scoreFromFindings([
        createFinding('critical'),
        createFinding('warning'),
        createFinding('info'),
      ]),
    ).toEqual({ value: 78, label: 'Ajustes pontuais' });
    expect(
      scoreFromFindings([
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
      ]),
    ).toEqual({ value: 40, label: 'Precisa de atenção' });
    expect(
      scoreFromFindings([
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
      ]),
    ).toEqual({ value: 25, label: 'Situação crítica' });
    expect(
      scoreFromFindings([
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
        createFinding('critical'),
      ]),
    ).toEqual({ value: 0, label: 'Situação crítica' });
  });
});
