import { render, screen } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import { GoogleSection } from './GoogleSection';
import { googleIndexUrl } from '../../lib/dominio';

describe('GoogleSection', () => {
  test('renders the main heading correctly', () => {
    render(<GoogleSection domainToConsult="example.com" />);

    const heading = screen.getByRole('heading', {
      name: 'Por que seu projeto de IA não aparece no Google?',
      level: 2,
    });
    expect(heading).not.toBeNull();
  });

  test('renders the link with correct attributes', () => {
    const domain = 'meusite.com.br';
    render(<GoogleSection domainToConsult={domain} />);

    const expectedUrl = googleIndexUrl(domain);
    const link = screen.getByRole('link', { name: 'Consultar no Google' });

    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(expectedUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
