import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Briefing } from '../../lib/message';
import type { AuditResult, PageSpeedReport } from '../../lib/types';
import { SecoesVisiveisContext } from '../SecoesVisiveisContext';
import { rotuloDaSecao, secoesVisiveis, type IdSecaoDaPagina } from '../secoesDaPagina';
import { AboutSection } from './AboutSection';
import { CompareSection } from './CompareSection';
import { CtaSection } from './CtaSection';
import { DomainSection } from './DomainSection';
import { FaqSection } from './FaqSection';
import { FindingsSection } from './FindingsSection';
import { GoogleSection } from './GoogleSection';
import { RequestSection } from './RequestSection';
import { ServicesSection } from './ServicesSection';
import { TermsSection } from './TermsSection';
import { WorkSection } from './WorkSection';

const briefingVazio: Briefing = {
  name: '',
  activity: '',
  need: '',
  currentSite: '',
  notes: '',
};

const pageSpeedExemplo: PageSpeedReport = {
  strategy: 'mobile',
  scores: { performance: 80, seo: 90, accessibility: 95, bestPractices: 90 },
  lab: {
    lcpMs: 1800,
    fcpMs: 900,
    cls: 0.01,
    tbtMs: 80,
    speedIndexMs: 1200,
    serverResponseMs: 120,
    totalBytes: 120000,
  },
  field: {
    available: false,
    origin: true,
    overall: 'FAST',
    lcp: { p75: null, category: null },
    cls: { p75: null, category: null },
    inp: { p75: null, category: null },
  },
  screenshot: null,
  screenshotSize: null,
  opportunities: [],
  fetchedAt: '2026-11-15T00:00:00.000Z',
};

const resultadoExemplo: AuditResult = {
  domain: 'exemplo.com.br',
  startedAt: '2026-11-15T00:00:00.000Z',
  finishedAt: '2026-11-15T00:00:01.000Z',
  dns: null,
  email: null,
  registration: null,
  content: null,
  pagespeed: pageSpeedExemplo,
  pagespeedError: null,
  contentError: null,
  score: null,
  coverage: { complete: true, missing: [] },
  findings: [],
};

const casos: Array<[IdSecaoDaPagina, () => ReturnType<typeof render>]> = [
  [
    'comparacao',
    () =>
      render(
        <CompareSection
          mobile={pageSpeedExemplo}
          desktop={null}
          desktopState="idle"
          result={resultadoExemplo}
        />,
      ),
  ],
  [
    'achados',
    () => render(<FindingsSection result={resultadoExemplo} grouped={[]} domain="exemplo.com.br" />),
  ],
  ['resolvo', () => render(<ServicesSection onQueroResolver={vi.fn()} />)],
  ['google', () => render(<GoogleSection domainToConsult="exemplo.com.br" />)],
  ['dominio', () => render(<DomainSection />)],
  ['condicoes', () => render(<TermsSection />)],
  ['sobre', () => render(<AboutSection />)],
  ['trabalhos', () => render(<WorkSection onAnalyze={vi.fn()} />)],
  [
    'atendimento',
    () => render(<RequestSection briefing={briefingVazio} onChange={vi.fn()} result={null} />),
  ],
  ['faq', () => render(<FaqSection />)],
  ['contato', () => render(<CtaSection result={null} domain="" />)],
];

describe('Rótulos numerados nas seções da página', () => {
  test.each(casos)(
    'seção "%s" exibe o rótulo decorativo acima do h2 conforme a lista',
    (id, renderizar) => {
      const { container } = renderizar();
      const rotulo = container.querySelector('.lp-section-label');
      const h2 = container.querySelector('h2');

      expect(rotulo).not.toBeNull();
      expect(rotulo).toHaveClass('lp-eyebrow');
      expect(rotulo).toHaveAttribute('aria-hidden', 'true');
      expect(rotulo?.textContent).toBe(rotuloDaSecao(id));
      expect(h2).not.toBeNull();
      expect(rotulo?.nextElementSibling).toBe(h2);
    },
  );

  test('usa a numeração do SecoesVisiveisContext quando fornecido', () => {
    const visiveis = secoesVisiveis({ temComparacao: false, temAchados: false });
    const { container } = render(
      <SecoesVisiveisContext.Provider value={visiveis}>
        <ServicesSection onQueroResolver={vi.fn()} />
      </SecoesVisiveisContext.Provider>,
    );

    expect(container.querySelector('.lp-section-label')?.textContent).toBe('01 // serviços');
  });
});
