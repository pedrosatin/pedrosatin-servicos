import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SECOES_DO_MENU } from '../secoesDoMenu';
import { ID_MENU_MOVEL, SiteHeader } from './SiteHeader';

const obterBotaoMenu = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'Menu' }) as HTMLButtonElement;

const obterPainelMovel = (container: HTMLElement): HTMLElement => {
  const painel = container.querySelector<HTMLElement>(`#${ID_MENU_MOVEL}`);
  if (!painel) throw new Error('Painel do menu móvel ausente');
  return painel;
};

describe('SiteHeader', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('alterna aria-expanded e controla o painel pelo mesmo id em aria-controls', () => {
    const { container } = render(<SiteHeader result={null} domain="" />);
    const botao = obterBotaoMenu();
    const painel = obterPainelMovel(container);

    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao).toHaveAttribute('aria-controls', ID_MENU_MOVEL);
    expect(painel).toHaveAttribute('hidden');
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(painel).not.toHaveAttribute('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(painel).toHaveAttribute('hidden');
    expect(document.body.style.overflow).toBe('');
  });

  test('fecha ao apertar Esc e devolve o foco ao botão Menu', () => {
    const { container } = render(<SiteHeader result={null} domain="" />);
    const botao = obterBotaoMenu();
    const painel = obterPainelMovel(container);

    fireEvent.click(botao);
    const primeiroLink = within(painel).getByRole('link', { name: /Análise/ });
    primeiroLink.focus();
    expect(document.activeElement).toBe(primeiroLink);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(painel).toHaveAttribute('hidden');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(botao);
  });

  test('fecha ao clicar fora do cabeçalho ou no fundo escurecido', () => {
    const { container } = render(<SiteHeader result={null} domain="" />);
    const botao = obterBotaoMenu();

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');

    const contatos = container.querySelector('.lp-mobile-panel-contacts');
    fireEvent.mouseDown(contatos as HTMLElement);
    expect(botao).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(document.body);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(botao);
    const fundo = container.querySelector('.lp-menu-backdrop') as HTMLElement;
    expect(fundo).not.toBeNull();
    fireEvent.click(fundo);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });

  test('fecha ao clicar em um link de seção e libera a rolagem', () => {
    const { container } = render(<SiteHeader result={null} domain="" />);
    const botao = obterBotaoMenu();
    const painel = obterPainelMovel(container);

    fireEvent.click(botao);
    expect(document.body.style.overflow).toBe('hidden');

    const orcamento = within(painel).getByRole('link', { name: /Orçamento/ });
    fireEvent.click(orcamento);

    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(painel).toHaveAttribute('hidden');
    expect(document.body.style.overflow).toBe('');
  });

  test('fecha quando a largura passa do limite do celular', () => {
    let aoMudar: () => void = () => undefined;
    const consulta = {
      matches: true,
      addEventListener: vi.fn((_tipo: string, ouvinte: () => void) => {
        aoMudar = ouvinte;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => consulta));

    render(<SiteHeader result={null} domain="" />);
    const botao = obterBotaoMenu();

    fireEvent.click(botao);
    aoMudar();
    expect(botao).toHaveAttribute('aria-expanded', 'true');

    consulta.matches = false;
    act(() => aoMudar());
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
  });

  test('fecha quando o foco sai do cabeçalho com o menu aberto', () => {
    const { container } = render(
      <>
        <SiteHeader result={null} domain="" />
        <a href="#foto" data-testid="fora">
          foto
        </a>
      </>,
    );
    const botao = obterBotaoMenu();
    const painel = obterPainelMovel(container);

    fireEvent.click(botao);
    within(painel).getByRole('link', { name: 'GitHub' }).focus();
    expect(botao).toHaveAttribute('aria-expanded', 'true');

    act(() => screen.getByTestId('fora').focus());
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
  });

  test('exibe todas as seções e Orçamento nos dois menus a partir da mesma lista', () => {
    const { container } = render(<SiteHeader result={null} domain="" />);
    const botao = obterBotaoMenu();
    fireEvent.click(botao);

    const navDesktop = screen.getByRole('navigation', { name: 'Navegação principal' });
    const navMovel = screen.getByRole('navigation', { name: 'Seções da página' });

    const linksDesktop = within(navDesktop).getAllByRole('link');
    const linksMovel = within(navMovel).getAllByRole('link');

    expect(linksDesktop.map((link) => link.getAttribute('href'))).toEqual(
      SECOES_DO_MENU.map((secao) => `#${secao.id}`),
    );
    expect(linksMovel.map((link) => link.getAttribute('href'))).toEqual(
      SECOES_DO_MENU.map((secao) => `#${secao.id}`),
    );

    const orcamentoDesktop = within(navDesktop).getByRole('link', { name: 'Orçamento' });
    const orcamentoMovel = within(navMovel).getByRole('link', { name: /Orçamento/ });
    expect(orcamentoDesktop).toHaveAttribute('href', '#atendimento');
    expect(orcamentoMovel).toHaveAttribute('href', '#atendimento');
    expect(orcamentoMovel).toHaveClass('is-featured');

    const painel = obterPainelMovel(container);
    const focaveisDoPainel = Array.from(painel.querySelectorAll('a'));
    expect(focaveisDoPainel.at(-3)).toHaveTextContent('Falar no WhatsApp');
    expect(focaveisDoPainel.at(-2)).toHaveTextContent('LinkedIn');
    expect(focaveisDoPainel.at(-1)).toHaveTextContent('GitHub');
  });

  test('libera a rolagem do corpo se desmontar com o menu aberto', () => {
    const { unmount } = render(<SiteHeader result={null} domain="" />);
    fireEvent.click(obterBotaoMenu());
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  test('renderToString inclui todos os links de seção e o painel móvel no HTML', () => {
    const html = renderToString(<SiteHeader result={null} domain="" />);

    expect(html).toContain(`id="${ID_MENU_MOVEL}"`);
    expect(html).toContain(`aria-controls="${ID_MENU_MOVEL}"`);
    expect(html).toContain('aria-expanded="false"');

    for (const secao of SECOES_DO_MENU) {
      expect(html).toContain(`href="#${secao.id}"`);
      expect(html).toContain(secao.label);
    }
  });
});
