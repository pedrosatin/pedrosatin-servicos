import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { AuditResult, PageSpeedReport } from '../../lib/types';
import type { AuditPhase } from '../../lib/useAudit';
import { HeroAnalysisSection } from './HeroAnalysisSection';

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

type Props = React.ComponentProps<typeof HeroAnalysisSection>;

const renderizar = (
  phase: AuditPhase,
  result: AuditResult | null = null,
  error: string | null = null,
  extra: Partial<Props> = {},
) => {
  const props: Props = {
    phase,
    steps: [],
    result,
    error,
    domain: 'exemplo.com.br',
    input: 'exemplo.com.br',
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    onAnalyze: vi.fn(),
    inputRef: { current: null },
    logRef: { current: null },
    mobile: null,
    deviceTime: '--:--',
    counts: result ? { critical: 0, warning: 0, info: 0, good: 0 } : null,
    ...extra,
  };
  return render(<HeroAnalysisSection {...props} />);
};

describe('HeroAnalysisSection: anúncios para leitor de tela', () => {
  test('as regiões de status e de alerta já existem, vazias, antes da análise', () => {
    renderizar('idle');

    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    expect(screen.getByRole('alert')).toHaveTextContent(/^$/);
  });

  test('anuncia o início sem ler as linhas do terminal', () => {
    renderizar('running');

    expect(screen.getByRole('status')).toHaveTextContent('Análise de exemplo.com.br iniciada.');
  });

  test('anuncia a nota ao concluir', () => {
    renderizar('done', resultado({ score: { value: 74, label: 'Ajustes pontuais' } }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Análise de exemplo.com.br concluída. Nota 74 de 100: ajustes pontuais.',
    );
  });

  test('anuncia "sem nota" e nenhum número quando a cobertura é incompleta', () => {
    renderizar(
      'done',
      resultado({
        coverage: { complete: false, missing: ['medição do Google (PageSpeed)'] },
      }),
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      'Análise de exemplo.com.br concluída. Sem nota: cobertura incompleta. ' +
        'Não foi possível concluir medição do Google (PageSpeed).',
    );
    expect(status.textContent).not.toMatch(/\d/);
  });

  test('põe o erro na região de alerta e deixa o status vazio', () => {
    renderizar('error', null, 'Endereço inválido. Use o formato exemplo.com.br');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Endereço inválido. Use o formato exemplo.com.br',
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
  });
});

describe('HeroAnalysisSection: terminal', () => {
  test('um exemplo da lista pede a análise daquele domínio', () => {
    const onAnalyze = vi.fn();
    renderizar('idle', null, null, { onAnalyze });

    fireEvent.click(screen.getByRole('button', { name: 'pedrosatin.com' }));

    expect(onAnalyze).toHaveBeenCalledWith('pedrosatin.com');
  });

  test('mostra cada etapa no terminal, com tempo e detalhe quando houver', () => {
    renderizar('running', null, null, {
      steps: [
        {
          id: 'dns',
          label: 'DNS',
          command: 'dig exemplo.com.br',
          status: 'done',
          detail: '1 registro(s) A',
          durationMs: 8,
        },
        {
          id: 'pagespeed',
          label: 'PageSpeed',
          command: 'pagespeed exemplo.com.br',
          status: 'running',
          detail: null,
          durationMs: null,
        },
      ],
    });

    const linhas = screen.getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('dig exemplo.com.br');
    expect(linhas[0]).toHaveTextContent('1 registro(s) A');
    expect(linhas[1]).toHaveTextContent('pagespeed exemplo.com.br');
    expect(linhas[1]?.querySelector('.lp-log-detail')).toBeNull();
    // As linhas não entram no anúncio; só o início da análise é lido.
    expect(screen.getByRole('status')).toHaveTextContent('Análise de exemplo.com.br iniciada.');
  });
});

describe('HeroAnalysisSection: screenshot do celular', () => {
  const captura = (screenshot: string | null): PageSpeedReport =>
    ({ screenshot, screenshotSize: null, fetchedAt: '2026-11-14T12:00:00.000Z' }) as PageSpeedReport;
  const placeholder = 'A captura do seu site aparece aqui';

  test.each(['data:image/jpeg;base64,/9j/4AAQ', 'data:image/webp;base64,UklGRg=='])(
    'renderiza %s',
    (screenshot) => {
      const { container } = renderizar('done', resultado({}), null, { mobile: captura(screenshot) });

      expect(container.querySelector('.lp-device-screen img')).toHaveAttribute('src', screenshot);
    },
  );

  test.each([
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:text/html;base64,PHNjcmlwdD4=',
    'https://exemplo.com.br/captura.jpg',
    'DATA:IMAGE/JPEG;base64,AAAA',
    ' data:image/jpeg;base64,AAAA',
  ])('não renderiza %s e mantém o placeholder', (screenshot) => {
    const { container } = renderizar('done', resultado({}), null, { mobile: captura(screenshot) });

    expect(container.querySelector('.lp-device-screen img')).toBeNull();
    expect(screen.getByText(placeholder)).toBeInTheDocument();
  });

  test('sem screenshot, mantém o placeholder', () => {
    const { container } = renderizar('done', resultado({}), null, { mobile: captura(null) });

    expect(container.querySelector('.lp-device-screen img')).toBeNull();
    expect(screen.getByText(placeholder)).toBeInTheDocument();
  });
});

describe('HeroAnalysisSection: resumo ao concluir', () => {
  test.each(['idle', 'running', 'error'] as AuditPhase[])(
    'não aparece na fase %s',
    (phase) => {
      const { container } = renderizar(phase);

      expect(container.querySelector('.lp-terminal-summary')).toBeNull();
      expect(screen.queryByRole('link', { name: 'ver resultado' })).toBeNull();
    },
  );

  test('mostra a nota ao concluir com score e oferece o link para o veredito', () => {
    const { container } = renderizar(
      'done',
      resultado({ score: { value: 92, label: 'Bem resolvido' } }),
    );

    const resumo = container.querySelector('.lp-terminal-summary');
    expect(resumo).not.toBeNull();
    expect(resumo).toHaveTextContent('Nota 92 de 100: bem resolvido');
    expect(screen.getByText('Nota 92 de 100: bem resolvido')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByRole('link', { name: 'ver resultado' })).toHaveAttribute(
      'href',
      '#resultado',
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  test('mostra "sem nota" e nenhum dígito quando a cobertura é incompleta', () => {
    const { container } = renderizar(
      'done',
      resultado({
        score: null,
        coverage: { complete: false, missing: ['medição do Google (PageSpeed)'] },
      }),
    );

    const resumo = container.querySelector('.lp-terminal-summary');
    expect(resumo).not.toBeNull();
    expect(resumo).toHaveClass('no-score');
    expect(resumo).toHaveTextContent('Sem nota: cobertura incompleta');
    expect(resumo?.textContent).not.toMatch(/\d/);
  });

  test('some quando uma nova análise começa', () => {
    const propsBase: Props = {
      phase: 'done',
      steps: [],
      result: resultado({ score: { value: 88, label: 'Bem resolvido' } }),
      error: null,
      domain: 'exemplo.com.br',
      input: 'exemplo.com.br',
      onInputChange: vi.fn(),
      onSubmit: vi.fn(),
      onAnalyze: vi.fn(),
      inputRef: { current: null },
      logRef: { current: null },
      mobile: null,
      deviceTime: '--:--',
      counts: { critical: 0, warning: 0, info: 0, good: 0 },
    };
    const { container, rerender } = render(<HeroAnalysisSection {...propsBase} />);

    expect(container.querySelector('.lp-terminal-summary')).not.toBeNull();

    rerender(<HeroAnalysisSection {...propsBase} phase="running" result={null} counts={null} />);

    expect(container.querySelector('.lp-terminal-summary')).toBeNull();
  });

  test('clicar em "ver resultado" rola suave até o veredito e põe o foco nele', () => {
    const { container } = renderizar(
      'done',
      resultado({ score: { value: 92, label: 'Bem resolvido' } }),
    );
    const veredito = container.querySelector('#resultado') as HTMLElement;
    expect(veredito).not.toBeNull();
    expect(veredito).toHaveAttribute('tabindex', '-1');

    const rolar = vi.fn();
    veredito.scrollIntoView = rolar;
    const focar = vi.spyOn(veredito, 'focus');

    const link = screen.getByRole('link', { name: 'ver resultado' });
    const seguiuHref = fireEvent.click(link);

    expect(seguiuHref).toBe(false);
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(focar).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(veredito);
  });

  test('clicar em "ver resultado" quando o veredito não está no DOM não lança erro', () => {
    renderizar('done', resultado({ score: { value: 92, label: 'Bem resolvido' } }), null, {
      counts: null,
    });

    const link = screen.getByRole('link', { name: 'ver resultado' });
    expect(() => fireEvent.click(link)).not.toThrow();
  });
});
