import { render } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import { FaqSection } from './FaqSection';
import { FAQ_ITEMS } from '../../lib/faq';

describe('FaqSection', () => {
  test('renders the main title and subtitle', () => {
    const { container } = render(<FaqSection />);
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toBe('Perguntas frequentes');

    const subtitle = container.querySelector('.lp-h2-sub');
    expect(subtitle?.textContent?.trim()).toBe('Respostas diretas para as dúvidas mais comuns.');
  });

  test('renders a <details> element for each item in FAQ_ITEMS', () => {
    const { container } = render(<FaqSection />);
    const details = container.querySelectorAll('details.lp-faq-item');
    expect(details).toHaveLength(FAQ_ITEMS.length);
  });

  test('opens the first <details> item by default', () => {
    const { container } = render(<FaqSection />);
    const details = container.querySelectorAll('details.lp-faq-item');
    expect(details[0]?.hasAttribute('open')).toBe(true);

    for (let i = 1; i < details.length; i++) {
      expect(details[i]?.hasAttribute('open')).toBe(false);
    }
  });

  test('renders the correct question in the summary and paragraphs in the answer', () => {
    const { container } = render(<FaqSection />);
    const details = container.querySelectorAll('details.lp-faq-item');

    FAQ_ITEMS.forEach((item, index) => {
      const detailElement = details[index]!;

      const summary = detailElement.querySelector('summary span');
      expect(summary?.textContent).toBe(item.q);

      const answerContainer = detailElement.querySelector('.lp-faq-answer');
      const paragraphs = answerContainer?.querySelectorAll('p');

      expect(paragraphs).toHaveLength(item.a.length);
      item.a.forEach((pText, pIndex) => {
        expect(paragraphs?.[pIndex]?.textContent).toBe(pText);
      });
    });
  });
});
