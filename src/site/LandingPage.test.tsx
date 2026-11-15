import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { expect, describe, test, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';
import * as sources from '../lib/sources';
import * as useAudit from '../lib/useAudit';
import type { AuditResult, AuditStep } from '../lib/types';
import type { AuditPhase } from '../lib/useAudit';
import { SERVICES } from '../lib/services';
import { SECOES_DA_PAGINA, rotuloDaSecao } from './secoesDaPagina';

vi.mock('../lib/sources', () => ({
  fetchPageSpeed: vi.fn(),
}));

const useMockAudit = (): useAudit.UseAuditReturn => {
  const [state, setState] = useState<{
    phase: AuditPhase;
    steps: AuditStep[];
    result: AuditResult | null;
    error: string | null;
    domain: string;
  }>({
    phase: 'idle',
    steps: [],
    result: null,
    error: null,
    domain: '',
  });

  const start = async (input: string) => {
    setState((prev) => ({ ...prev, phase: 'running', domain: input }));

    await new Promise((resolve) => setTimeout(resolve, 10));

    const result: AuditResult = {
      domain: input,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      dns: null,
      email: null,
      registration: null,
      content: null,
      pagespeedError: null,
      contentError: null,
      score: null,
      pagespeed: {
        strategy: 'mobile' as const,
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
        fetchedAt: new Date().toISOString(),
      },
      coverage: { complete: true, missing: [] },
      findings: [],
    };

    setState({
      phase: 'done',
      steps: [],
      result,
      error: null,
      domain: input,
    });

    return result;
  };

  return {
    ...state,
    start,
    reset: () => {},
  };
};

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A suíte completa deixa o jsdom mais lento; 5s padrão falha sob carga.
  test('handles fetchPageSpeed failure for desktop gracefully', async () => {
    const error = new Error('PageSpeed Failed');
    vi.mocked(sources.fetchPageSpeed).mockRejectedValue(error);
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);

    render(<LandingPage />);

    const input = screen.getByRole('textbox', { name: /Endereço do site a analisar/i });
    const button = screen.getByRole('button', { name: /executar/i });

    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(button);

    await waitFor(
      () => {
        expect(
          screen.getByText(/A medição em computador não pôde ser feita agora/i),
        ).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
  }, 15_000);

  test('o primeiro elemento focável é o link de pular, e ele põe o foco no campo', () => {
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(<LandingPage />);

    const primeiro = container.querySelector('a[href], button, input, textarea, summary');
    expect(primeiro).toHaveTextContent('Pular para a análise');
    expect(primeiro).toHaveAttribute('href', '#analise');

    // Enter num link dispara o clique; o jsdom não simula essa tecla.
    fireEvent.click(primeiro as HTMLElement);

    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: /Endereço do site a analisar/i }),
    );
  });

  test('o HTML pré-renderizado já traz as regiões de status e de alerta, vazias', () => {
    const html = renderToString(<LandingPage />);

    expect(html).toMatch(/<p role="status" class="lp-sr-only"><\/p>/);
    expect(html).toMatch(/<p class="lp-error" role="alert"><\/p>/);
  });

  test.each(SERVICES.map((service) => [service.title, service.need]))(
    'o card "%s" marca "%s" no formulário e leva o foco ao Nome',
    (title, need) => {
      vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);
      const rolar = vi.fn();
      Element.prototype.scrollIntoView = rolar;
      render(<LandingPage />);

      fireEvent.click(screen.getByRole('link', { name: `Quero resolver isso: ${title}` }));

      expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(screen.getByRole('button', { name: need })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Nome' }));
    },
  );

  test('trocar de card troca a necessidade marcada e preserva o que já foi digitado', () => {
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);
    Element.prototype.scrollIntoView = vi.fn();
    render(<LandingPage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), { target: { value: 'Ana' } });

    fireEvent.click(screen.getByRole('link', { name: /Quero resolver isso: Deploy/ }));
    fireEvent.click(screen.getByRole('link', { name: /Quero resolver isso: SEO/ }));

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Ana');
    expect(
      screen.getByRole('button', { name: 'Quero que meu site apareça no Google' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('as seções com h2 exibem rótulos em sequência sem lacuna na ordem da página', () => {
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);
    const { container } = render(<LandingPage />);

    const secoesComH2 = Array.from(container.querySelectorAll('main > section')).filter(
      (secao) => secao.querySelector('h2') !== null,
    );
    const rotulos = Array.from(container.querySelectorAll('main .lp-section-label'));

    expect(rotulos).toHaveLength(secoesComH2.length);
    expect(rotulos.map((el) => el.textContent)).toEqual(
      SECOES_DA_PAGINA.map((secao) => rotuloDaSecao(secao.id)),
    );
    rotulos.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true');
      expect(el.nextElementSibling?.tagName).toBe('H2');
    });
  });
});
