import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { AuditResult } from '../../lib/types';
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
