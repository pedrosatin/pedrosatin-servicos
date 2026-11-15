import { render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/react';
import { expect, describe, test, vi } from 'vitest';
import { ServicesSection } from './ServicesSection';
import { NEEDS, NEED_OPTIONS, SERVICES } from '../../lib/services';

describe('ServicesSection', () => {
  test('renders the section with correct id and headers', () => {
    const { container } = render(<ServicesSection onQueroResolver={vi.fn()} />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('id')).toBe('resolvo');
    expect(section?.className).toBe('lp-services');

    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('O que eu resolvo');
  });

  test('renders the correct number of service articles based on SERVICES constant', () => {
    const { container } = render(<ServicesSection onQueroResolver={vi.fn()} />);
    const articles = container.querySelectorAll('article');
    expect(articles).toHaveLength(SERVICES.length);
  });

  test('renders article content correctly with padded index', () => {
    const { container } = render(<ServicesSection onQueroResolver={vi.fn()} />);
    const articles = container.querySelectorAll('article');

    const firstArticle = articles[0];
    expect(firstArticle?.querySelector('.lp-service-index')?.textContent).toBe('01');
    expect(firstArticle?.querySelector('h3')?.textContent).toBe(SERVICES[0]?.title);
    expect(firstArticle?.querySelector('p')?.textContent).toBe(SERVICES[0]?.body);
  });

  test('cada card traz o link "Quero resolver isso" para o formulário', () => {
    const { container } = render(<ServicesSection onQueroResolver={vi.fn()} />);

    const links = container.querySelectorAll('article a.lp-service-cta');
    expect(links).toHaveLength(6);
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '#atendimento');
      expect(link).toHaveTextContent('Quero resolver isso');
    });
  });

  test.each(SERVICES.map((service) => [service.title, service.need]))(
    'o card "%s" marca a necessidade "%s" e não segue o href',
    (title, need) => {
      const onQueroResolver = vi.fn();
      render(<ServicesSection onQueroResolver={onQueroResolver} />);

      const link = screen.getByRole('link', { name: `Quero resolver isso: ${title}` });
      const seguiuHref = fireEvent.click(link);

      expect(seguiuHref).toBe(false);
      expect(onQueroResolver).toHaveBeenCalledExactlyOnceWith(need);
    },
  );

  test('mapeia os 6 cards para necessidades que o formulário oferece', () => {
    expect(SERVICES.map((service) => service.need)).toEqual([
      NEEDS.publicar,
      NEEDS.bugs,
      NEEDS.integrar,
      NEEDS.integrar,
      NEEDS.lento,
      NEEDS.google,
    ]);
    SERVICES.forEach((service) => expect(NEED_OPTIONS).toContain(service.need));
  });
});
