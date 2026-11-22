import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SiteHeader } from './components/SiteHeader';
import { PROPRIEDADE_ALTURA_CABECALHO } from './useAlturaDoCabecalho';

const lerPropriedade = (): string =>
  document.documentElement.style.getPropertyValue(PROPRIEDADE_ALTURA_CABECALHO);

let alturaAtual = 72;
let aoRedimensionar: (() => void) | null = null;
const desconectar = vi.fn();

class ResizeObserverFalso {
  constructor(callback: () => void) {
    aoRedimensionar = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = desconectar;
}

describe('useAlturaDoCabecalho', () => {
  beforeEach(() => {
    alturaAtual = 72;
    aoRedimensionar = null;
    desconectar.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => alturaAtual);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('publica a altura do cabeçalho em --lp-header-h ao montar', () => {
    render(<SiteHeader result={null} domain="" />);

    expect(lerPropriedade()).toBe('72px');
  });

  test('atualiza a propriedade quando o cabeçalho muda de altura', () => {
    render(<SiteHeader result={null} domain="" />);

    alturaAtual = 104;
    aoRedimensionar?.();

    expect(lerPropriedade()).toBe('104px');
  });

  test('remove a propriedade e desconecta o observador ao desmontar', () => {
    const { unmount } = render(<SiteHeader result={null} domain="" />);
    unmount();

    expect(desconectar).toHaveBeenCalledTimes(1);
    expect(lerPropriedade()).toBe('');
  });

  test('sem ResizeObserver, mede de novo no redimensionamento da janela', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { unmount } = render(<SiteHeader result={null} domain="" />);
    expect(lerPropriedade()).toBe('72px');

    alturaAtual = 96;
    window.dispatchEvent(new Event('resize'));
    expect(lerPropriedade()).toBe('96px');

    unmount();
    expect(lerPropriedade()).toBe('');
  });
});
