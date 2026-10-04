import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Footer } from './Footer';
import { PROFILE, CONTACT } from '../../lib/config';

describe('Footer', () => {
  test('renders main footer information', () => {
    render(<Footer />);

    expect(screen.getByText('Pedro Satin')).toBeDefined();
    expect(screen.getByText('engenharia de software e desenvolvimento web')).toBeDefined();
    expect(screen.getByText('atendimento remoto')).toBeDefined();
  });

  test('renders the correct sources message', () => {
    render(<Footer />);

    expect(
      screen.getByText(/Fontes da análise: PageSpeed Insights do Google, RDAP do Registro.br/)
    ).toBeDefined();
  });

  test('renders signature and links with correct configurations', () => {
    render(<Footer />);

    // Porfolio link (handled via CONTACT.handle)
    const portfolioLink = screen.getByText(CONTACT.handle);
    expect(portfolioLink.getAttribute('href')).toBe(PROFILE.portfolio);
    expect(portfolioLink.getAttribute('target')).toBe('_blank');

    // LinkedIn link
    const linkedinLink = screen.getByText('LinkedIn');
    expect(linkedinLink.getAttribute('href')).toBe(PROFILE.linkedin);
    expect(linkedinLink.getAttribute('target')).toBe('_blank');

    // GitHub link
    const githubLink = screen.getByText('GitHub');
    expect(githubLink.getAttribute('href')).toBe(PROFILE.github);
    expect(githubLink.getAttribute('target')).toBe('_blank');

    // llms.txt link
    const llmsLink = screen.getByText('llms.txt');
    expect(llmsLink.getAttribute('href')).toBe('/llms.txt');
    expect(llmsLink.getAttribute('target')).toBe('_blank');
  });
});
