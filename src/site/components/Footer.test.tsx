import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Footer } from './Footer';
import { PROFILE, CONTACT } from '../../lib/config';
import { SECOES_DO_MENU } from '../secoesDoMenu';

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

  test('exibe o número de WhatsApp no bloco Contato apontando para wa.me', () => {
    render(<Footer />);

    expect(screen.getByRole('heading', { name: 'Contato' })).toBeInTheDocument();

    const whatsappLink = screen.getByRole('link', { name: CONTACT.whatsappDisplay });
    expect(whatsappLink).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`^https://wa\\.me/${CONTACT.whatsapp}\\?text=`)),
    );
    expect(whatsappLink).toHaveAttribute('target', '_blank');
    expect(whatsappLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('exibe os links das seções a partir de SECOES_DO_MENU', () => {
    render(<Footer />);

    expect(screen.getByRole('heading', { name: 'Seções' })).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Seções do rodapé' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      SECOES_DO_MENU.map((secao) => `#${secao.id}`),
    );
    expect(links.map((link) => link.textContent)).toEqual(
      SECOES_DO_MENU.map((secao) => secao.label),
    );

    const orcamentoLink = within(nav).getByRole('link', { name: 'Orçamento' });
    expect(orcamentoLink).toHaveAttribute('href', '#atendimento');
    expect(orcamentoLink).toHaveClass('is-featured');
  });

  test('renders signature and links with correct configurations', () => {
    const { container } = render(<Footer />);

    expect(screen.getByText('feito por')).toBeInTheDocument();
    expect(container.querySelector('.lp-footer-divider')).toBeNull();

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
