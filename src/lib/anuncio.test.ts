import { describe, expect, it } from 'vitest';
import { anuncioDaAuditoria, motivoSemNota, resumoDoVeredito } from './anuncio';
import type { AuditResult } from './types';

const resultado = (parcial: Partial<AuditResult>): AuditResult => ({
  domain: 'exemplo.com.br',
  startedAt: '2026-11-14T12:00:00.000Z',
  finishedAt: '2026-11-14T12:00:30.000Z',
  coverage: { complete: true, missing: [] },
  dns: null,
  email: null,
  registration: null,
  content: null,
  pagespeed: null,
  pagespeedError: null,
  contentError: null,
  findings: [],
  score: null,
  ...parcial,
});

const comNota = resultado({ score: { value: 92, label: 'Bem resolvido' } });
const semNota = resultado({
  coverage: {
    complete: false,
    missing: ['resolução de DNS', 'medição do Google (PageSpeed)'],
  },
});

describe('resumoDoVeredito', () => {
  it('mostra a nota quando o resultado tem score', () => {
    expect(resumoDoVeredito(comNota)).toBe('Nota 92 de 100: bem resolvido');
  });

  it('diz "sem nota" e não mostra número quando a cobertura é incompleta', () => {
    const texto = resumoDoVeredito(semNota);
    expect(texto).toBe('Sem nota: cobertura incompleta');
    expect(texto).not.toMatch(/\d/);
  });
});

describe('motivoSemNota', () => {
  it('lista o que faltou quando não há nota', () => {
    expect(motivoSemNota(semNota)).toBe(
      'Não foi possível concluir resolução de DNS e medição do Google (PageSpeed).',
    );
  });

  it('não tem motivo quando há nota', () => {
    expect(motivoSemNota(comNota)).toBeNull();
  });

  it('não tem motivo quando a lista do que faltou está vazia', () => {
    expect(motivoSemNota(resultado({}))).toBeNull();
  });
});

describe('anuncioDaAuditoria', () => {
  it('fica vazio antes da primeira análise', () => {
    expect(anuncioDaAuditoria({ phase: 'idle', domain: '', result: null })).toBe('');
  });

  it('anuncia o início com o domínio', () => {
    expect(
      anuncioDaAuditoria({ phase: 'running', domain: 'exemplo.com.br', result: null }),
    ).toBe('Análise de exemplo.com.br iniciada.');
  });

  it('anuncia a conclusão com a nota', () => {
    expect(
      anuncioDaAuditoria({ phase: 'done', domain: 'exemplo.com.br', result: comNota }),
    ).toBe('Análise de exemplo.com.br concluída. Nota 92 de 100: bem resolvido.');
  });

  it('anuncia a conclusão sem nota, com o motivo e sem número', () => {
    const texto = anuncioDaAuditoria({ phase: 'done', domain: 'exemplo.com.br', result: semNota });
    expect(texto).toBe(
      'Análise de exemplo.com.br concluída. Sem nota: cobertura incompleta. ' +
        'Não foi possível concluir resolução de DNS e medição do Google (PageSpeed).',
    );
    expect(texto).not.toMatch(/\d/);
  });

  it('fica vazio no erro, que vai para a região de alerta', () => {
    expect(anuncioDaAuditoria({ phase: 'error', domain: 'x', result: null })).toBe('');
  });
});
