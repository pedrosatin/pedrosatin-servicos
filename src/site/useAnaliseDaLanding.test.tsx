import { useState } from 'react';
import type React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as sources from '../lib/sources';
import * as useAudit from '../lib/useAudit';
import type { AuditPhase } from '../lib/useAudit';
import type { AuditResult, Finding, PageSpeedReport } from '../lib/types';
import { useAnaliseDaLanding } from './useAnaliseDaLanding';

vi.mock('../lib/sources', () => ({
  fetchPageSpeed: vi.fn(),
}));

const pagespeed = (strategy: 'mobile' | 'desktop'): PageSpeedReport => ({
  strategy,
  scores: { performance: 50, seo: 50, accessibility: 50, bestPractices: 50 },
  lab: {
    lcpMs: 1000,
    fcpMs: 1000,
    cls: 0,
    tbtMs: 100,
    speedIndexMs: 1000,
    serverResponseMs: 100,
    totalBytes: 1000,
  },
  field: {
    available: false,
    origin: true,
    overall: 'FAST',
    lcp: { p75: 100, category: 'FAST' },
    cls: { p75: 0, category: 'FAST' },
    inp: { p75: 0, category: 'FAST' },
  },
  screenshot: null,
  screenshotSize: null,
  opportunities: [],
  fetchedAt: '2026-11-14T12:00:00.000Z',
});

const achados: Finding[] = [
  { id: '1', severity: 'critical', title: '1', evidence: '', action: '', area: 'seguranca' },
  { id: '2', severity: 'good', title: '2', evidence: '', action: '', area: 'desempenho' },
  { id: '3', severity: 'warning', title: '3', evidence: '', action: '', area: 'seguranca' },
];

const resultado = (domain: string, comPagespeed: boolean): AuditResult => ({
  domain,
  startedAt: '2026-11-14T12:00:00.000Z',
  finishedAt: '2026-11-14T12:00:30.000Z',
  dns: null,
  email: null,
  registration: null,
  content: null,
  pagespeed: comPagespeed ? pagespeed('mobile') : null,
  pagespeedError: null,
  contentError: null,
  score: null,
  coverage: { complete: true, missing: [] },
  findings: achados,
});

/**
 * Auditoria falsa controlada pelo teste: cada `start` fica pendente até o
 * teste chamar `terminar`, para dar para observar a fase `running`.
 */
let pendentes: Array<() => void> = [];
let comPagespeed = true;
const iniciadas: string[] = [];

const useAuditFalso = (): useAudit.UseAuditReturn => {
  const [state, setState] = useState<{
    phase: AuditPhase;
    result: AuditResult | null;
    domain: string;
  }>({ phase: 'idle', result: null, domain: '' });

  const start = (input: string): Promise<AuditResult | null> => {
    iniciadas.push(input);
    setState({ phase: 'running', result: null, domain: input });
    return new Promise((resolve) => {
      pendentes.push(() => {
        const result = resultado(input, comPagespeed);
        setState({ phase: 'done', result, domain: input });
        resolve(result);
      });
    });
  };

  return { ...state, steps: [], error: null, start, reset: () => {} };
};

const terminar = async (): Promise<void> => {
  const proximo = pendentes.shift();
  await act(async () => {
    proximo?.();
  });
};

const evento = { preventDefault: vi.fn() } as unknown as React.FormEvent;

describe('useAnaliseDaLanding', () => {
  beforeEach(() => {
    pendentes = [];
    comPagespeed = true;
    iniciadas.length = 0;
    vi.clearAllMocks();
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useAuditFalso);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('não analisa com o campo vazio', () => {
    const { result } = renderHook(() => useAnaliseDaLanding());

    act(() => result.current.setInput('   '));
    act(() => result.current.submit(evento));

    expect(evento.preventDefault).toHaveBeenCalled();
    expect(iniciadas).toEqual([]);
    expect(sources.fetchPageSpeed).not.toHaveBeenCalled();
  });

  test('mede o computador junto da auditoria e expõe contagem e grupos', async () => {
    vi.mocked(sources.fetchPageSpeed).mockResolvedValue(pagespeed('desktop'));
    const { result } = renderHook(() => useAnaliseDaLanding());

    act(() => result.current.setInput('example.com'));
    act(() => result.current.submit(evento));

    await waitFor(() => expect(result.current.desktopState).toBe('loading'));
    expect(sources.fetchPageSpeed).toHaveBeenCalledWith('example.com', 'desktop');
    expect(result.current.counts).toBeNull();
    expect(result.current.grouped).toEqual([]);
    expect(result.current.mobile).toBeNull();

    await terminar();

    await waitFor(() => expect(result.current.desktop?.strategy).toBe('desktop'));
    expect(result.current.desktopState).toBe('idle');
    expect(result.current.mobile?.strategy).toBe('mobile');
    expect(result.current.counts).toEqual({ critical: 1, warning: 1, info: 0, good: 1 });
    expect(result.current.grouped.map(([area]) => area)).toEqual(['seguranca', 'desempenho']);
  });

  test('marca a medição em computador como falha quando ela rejeita', async () => {
    vi.mocked(sources.fetchPageSpeed).mockRejectedValue(new Error('PageSpeed Failed'));
    const { result } = renderHook(() => useAnaliseDaLanding());

    act(() => result.current.runFor('https://example.com/'));
    await terminar();

    await waitFor(() => expect(result.current.desktopState).toBe('failed'));
    expect(result.current.desktop).toBeNull();
  });

  test('descarta a medição em computador quando a móvel não veio', async () => {
    comPagespeed = false;
    vi.mocked(sources.fetchPageSpeed).mockResolvedValue(pagespeed('desktop'));
    const { result } = renderHook(() => useAnaliseDaLanding());

    act(() => result.current.runFor('example.com'));
    await waitFor(() => expect(result.current.desktopState).toBe('loading'));
    await terminar();

    await waitFor(() => expect(result.current.phase).toBe('done'));
    expect(result.current.desktopState).toBe('idle');
    expect(result.current.desktop).toBeNull();
  });

  test('não mede o computador quando o domínio não é válido', async () => {
    const { result } = renderHook(() => useAnaliseDaLanding());

    act(() => result.current.runFor('localhost'));

    expect(iniciadas).toEqual(['localhost']);
    expect(result.current.desktopState).toBe('idle');
    await terminar();

    await waitFor(() => expect(result.current.phase).toBe('done'));
    expect(sources.fetchPageSpeed).not.toHaveBeenCalled();
    expect(result.current.desktopState).toBe('idle');
  });

  test('guarda o domínio pedido durante uma análise e o roda ao fim dela', async () => {
    vi.mocked(sources.fetchPageSpeed).mockResolvedValue(pagespeed('desktop'));
    const { result } = renderHook(() => useAnaliseDaLanding());

    act(() => result.current.runFor('primeiro.com.br'));
    await waitFor(() => expect(result.current.phase).toBe('running'));

    act(() => result.current.runFor('segundo.com.br'));
    // Um envio do formulário durante a análise também não começa outra.
    act(() => result.current.submit(evento));

    expect(result.current.input).toBe('segundo.com.br');
    expect(iniciadas).toEqual(['primeiro.com.br']);

    await terminar();

    await waitFor(() => expect(iniciadas).toEqual(['primeiro.com.br', 'segundo.com.br']));
    await terminar();
    await waitFor(() => expect(result.current.domain).toBe('segundo.com.br'));
  });

  test('foca o campo sem rolar e leva a página até a análise', () => {
    const secao = document.createElement('section');
    secao.id = 'analise';
    secao.scrollIntoView = vi.fn();
    document.body.appendChild(secao);
    const campo = document.createElement('input');
    const focar = vi.spyOn(campo, 'focus');

    const { result } = renderHook(() => useAnaliseDaLanding());
    result.current.inputRef.current = campo;

    act(() => result.current.runFor('example.com'));

    expect(secao.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(focar).toHaveBeenCalledWith({ preventScroll: true });
    secao.remove();
  });

  test('o link de pular leva a página até a análise e põe o foco no campo', () => {
    const secao = document.createElement('section');
    secao.id = 'analise';
    secao.scrollIntoView = vi.fn();
    document.body.appendChild(secao);
    const campo = document.createElement('input');
    const focar = vi.spyOn(campo, 'focus');
    const clique = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

    const { result } = renderHook(() => useAnaliseDaLanding());
    result.current.inputRef.current = campo;

    act(() => result.current.pularParaAnalise(clique));

    expect(clique.preventDefault).toHaveBeenCalled();
    expect(secao.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(focar).toHaveBeenCalledWith({ preventScroll: true });
    expect(iniciadas).toEqual([]);
    secao.remove();
  });

  test('com o campo desabilitado, o link de pular foca o bloco da análise', () => {
    const secao = document.createElement('section');
    secao.id = 'analise';
    secao.scrollIntoView = vi.fn();
    const focarSecao = vi.spyOn(secao, 'focus');
    document.body.appendChild(secao);
    const campo = document.createElement('input');
    campo.disabled = true;
    const focarCampo = vi.spyOn(campo, 'focus');
    const clique = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

    const { result } = renderHook(() => useAnaliseDaLanding());
    result.current.inputRef.current = campo;

    act(() => result.current.pularParaAnalise(clique));

    expect(focarCampo).not.toHaveBeenCalled();
    expect(focarSecao).toHaveBeenCalledWith({ preventScroll: true });
    secao.remove();
  });

  test('rola o registro da análise até a última linha', async () => {
    const registro = document.createElement('div');
    vi.spyOn(registro, 'scrollHeight', 'get').mockReturnValue(480);

    const { result } = renderHook(() => useAnaliseDaLanding());
    result.current.logRef.current = registro;

    act(() => result.current.runFor('localhost'));

    await waitFor(() => expect(registro.scrollTop).toBe(480));
  });
});
