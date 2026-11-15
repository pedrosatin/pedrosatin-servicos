import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Briefing } from '../../lib/message';
import { rotuloDaSecao, type IdSecaoDaPagina } from '../secoesDaPagina';
import { AboutSection } from './AboutSection';
import { CtaSection } from './CtaSection';
import { DomainSection } from './DomainSection';
import { FaqSection } from './FaqSection';
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

const casos: Array<[IdSecaoDaPagina, () => ReturnType<typeof render>]> = [
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
});
