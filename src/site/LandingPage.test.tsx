import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { expect, describe, test, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';
import * as sources from '../lib/sources';
import * as useAudit from '../lib/useAudit';
import type { AuditResult, AuditStep, PageSpeedReport } from '../lib/types';
import type { AuditPhase } from '../lib/useAudit';
import { SERVICES } from '../lib/services';
import { rotuloDaSecao, secoesVisiveis, type IdSecaoDaPagina } from './secoesDaPagina';

vi.mock('../lib/sources', () => ({
  fetchPageSpeed: vi.fn(),
}));

const criarPageSpeed = (strategy: 'mobile' | 'desktop'): PageSpeedReport => ({
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
  fetchedAt: new Date().toISOString(),
});

const criarResultado = (domain: string, comPageSpeed: boolean): AuditResult => ({
  domain,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  dns: null,
  email: null,
  registration: null,
  content: null,
  pagespeedError: comPageSpeed ? null : 'PageSpeed indisponível',
  contentError: null,
  score: null,
  pagespeed: comPageSpeed ? criarPageSpeed('mobile') : null,
  coverage: comPageSpeed
    ? { complete: true, missing: [] }
    : { complete: false, missing: ['medição do Google (PageSpeed)'] },
  findings: [],
});

const criarMockAudit = (comPageSpeed: boolean): (() => useAudit.UseAuditReturn) => {
  return () => {
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
      const result = criarResultado(input, comPageSpeed);
      setState({ phase: 'done', steps: [], result, error: null, domain: input });
      return result;
    };

    return { ...state, start, reset: () => {} };
  };
};

const useMockAudit = criarMockAudit(true);

const executarAnalise = (dominio: string): void => {
  const input = screen.getByRole('textbox', { name: /Endereço do site a analisar/i });
  const button = screen.getByRole('button', { name: /executar/i });
  fireEvent.change(input, { target: { value: dominio } });
  fireEvent.click(button);
};

const verificarRotulosEmSequencia = (
  container: HTMLElement,
  esperado: readonly IdSecaoDaPagina[],
  rodapeAlternado: boolean,
): void => {
  const secoes = Array.from(container.querySelectorAll('main > section:not(.lp-hero)'));
  const rotulos = Array.from(container.querySelectorAll('main .lp-section-label'));
  const esperados = esperado.map((id) => rotuloDaSecao(id, esperado));

  expect(secoes).toHaveLength(esperado.length);
  expect(rotulos).toHaveLength(secoes.length);
  expect(rotulos.map((el) => el.textContent)).toEqual(esperados);

  secoes.forEach((secao, indice) => {
    const rotulo = secao.querySelector('.lp-section-label');
    const h2 = secao.querySelector('h2');
    const numero = String(indice + 1).padStart(2, '0');

    expect(h2).not.toBeNull();
    expect(rotulo).not.toBeNull();
    expect(rotulo).toHaveAttribute('aria-hidden', 'true');
    expect(rotulo?.nextElementSibling).toBe(h2);
    expect(rotulo?.textContent).toMatch(/^\d{2} \/\/ [a-zà-ú]+$/);
    expect(rotulo?.textContent?.startsWith(`${numero} // `)).toBe(true);
  });

  const footer = container.querySelector('footer.lp-footer');
  expect(footer).not.toBeNull();
  if (rodapeAlternado) {
    expect(footer).toHaveClass('is-alt');
  } else {
    expect(footer).not.toHaveClass('is-alt');
  }
};

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('handles fetchPageSpeed failure for desktop gracefully', async () => {
    const error = new Error('PageSpeed Failed');
    vi.mocked(sources.fetchPageSpeed).mockRejectedValue(error);
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);

    render(<LandingPage />);
    executarAnalise('example.com');

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

    fireEvent.click(primeiro as HTMLElement);

    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: /Endereço do site a analisar/i }),
    );
  });

  test('o HTML pré-renderizado já traz as regiões de status e de alerta, vazias, e os 9 rótulos iniciais', () => {
    const html = renderToString(<LandingPage />);

    expect(html).toMatch(/<p role="status" class="lp-sr-only"><\/p>/);
    expect(html).toMatch(/<p class="lp-error" role="alert"><\/p>/);

    const semAnalise = secoesVisiveis({ temComparacao: false, temAchados: false });
    for (const id of semAnalise) {
      expect(html).toContain(rotuloDaSecao(id, semAnalise));
    }
    expect(html).not.toContain('comparação');
    expect(html).not.toContain('01 // achados');
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

  test('sem análise, exibe 9 rótulos em sequência sem lacuna e rodapé sem is-alt', () => {
    vi.spyOn(useAudit, 'useAudit').mockImplementation(useMockAudit);
    const { container } = render(<LandingPage />);

    const esperado = secoesVisiveis({ temComparacao: false, temAchados: false });
    verificarRotulosEmSequencia(container, esperado, false);
  });

  test('após análise completa, numera CompareSection, FindingsSection e as 9 fixas de 01 a 11', async () => {
    vi.mocked(sources.fetchPageSpeed).mockResolvedValue(criarPageSpeed('desktop'));
    vi.spyOn(useAudit, 'useAudit').mockImplementation(criarMockAudit(true));

    const { container } = render(<LandingPage />);
    executarAnalise('example.com');

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Celular e computador, lado a lado' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Achados da análise' })).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    const esperado = secoesVisiveis({ temComparacao: true, temAchados: true });
    verificarRotulosEmSequencia(container, esperado, false);
  }, 15_000);

  test('após análise sem PageSpeed de celular, numera FindingsSection e as 9 fixas de 01 a 10 com rodapé alternado', async () => {
    vi.mocked(sources.fetchPageSpeed).mockRejectedValue(new Error('Falha simulada'));
    vi.spyOn(useAudit, 'useAudit').mockImplementation(criarMockAudit(false));

    const { container } = render(<LandingPage />);
    executarAnalise('example.com');

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Achados da análise' })).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    expect(
      screen.queryByRole('heading', { name: 'Celular e computador, lado a lado' }),
    ).not.toBeInTheDocument();

    const esperado = secoesVisiveis({ temComparacao: false, temAchados: true });
    verificarRotulosEmSequencia(container, esperado, true);
  }, 15_000);
});
