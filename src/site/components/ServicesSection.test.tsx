import { render } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import { ServicesSection } from './ServicesSection';
import { SERVICES } from '../../lib/services';

describe('ServicesSection', () => {
  test('renders the section with correct id and headers', () => {
    const { container } = render(<ServicesSection />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('id')).toBe('resolvo');
    expect(section?.className).toBe('lp-services');

    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('O que eu resolvo');
  });

  test('renders the correct number of service articles based on SERVICES constant', () => {
    const { container } = render(<ServicesSection />);
    const articles = container.querySelectorAll('article');
    expect(articles).toHaveLength(SERVICES.length);
  });

  test('renders article content correctly with padded index', () => {
    const { container } = render(<ServicesSection />);
    const articles = container.querySelectorAll('article');

    const firstArticle = articles[0];
    expect(firstArticle?.querySelector('.lp-service-index')?.textContent).toBe('01');
    expect(firstArticle?.querySelector('h3')?.textContent).toBe(SERVICES[0]?.title);
    expect(firstArticle?.querySelector('p')?.textContent).toBe(SERVICES[0]?.body);
  });
});
