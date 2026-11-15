import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Faixa de largura em que o painel substitui o menu fixo de telas largas. */
const CONSULTA_CELULAR = '(max-width: 900px)';

const liberarRolagemDoCorpo = (): void => {
  document.body.style.overflow = '';
};

const travarRolagemDoCorpo = (): void => {
  document.body.style.overflow = 'hidden';
};

/**
 * Controla abertura, fechamento e foco do painel de navegação no celular.
 *
 * Enquanto o painel está aberto, a rolagem do `body` fica travada para evitar
 * que a página extensa role por baixo do fundo escurecido. `fechar()` libera a
 * rolagem antes de o navegador seguir a âncora do link clicado.
 */
export const useMenuMovel = (cabecalhoRef: RefObject<HTMLElement | null>) => {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const fechar = useCallback((): void => {
    liberarRolagemDoCorpo();
    setAberto(false);
  }, []);

  const alternar = useCallback((): void => {
    setAberto((atual) => !atual);
  }, []);

  useEffect(() => {
    if (!aberto) return;

    travarRolagemDoCorpo();

    const aoPressionarTecla = (evento: KeyboardEvent): void => {
      if (evento.key !== 'Escape') return;
      fechar();
      botaoRef.current?.focus();
    };

    // Cliques e foco fora do cabeçalho fecham o painel. O foco entra aqui
    // porque o Tab a partir do último link cairia em elementos que o painel
    // cobre, com a rolagem ainda travada.
    const aoInteragirFora = (evento: Event): void => {
      const alvo = evento.target as Node | null;
      if (!alvo || cabecalhoRef.current?.contains(alvo)) return;
      fechar();
    };

    const consulta =
      typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_CELULAR) : null;
    const aoMudarLargura = (): void => {
      if (consulta && !consulta.matches) fechar();
    };

    document.addEventListener('keydown', aoPressionarTecla);
    document.addEventListener('mousedown', aoInteragirFora);
    document.addEventListener('click', aoInteragirFora);
    document.addEventListener('focusin', aoInteragirFora);
    consulta?.addEventListener('change', aoMudarLargura);

    return () => {
      document.removeEventListener('keydown', aoPressionarTecla);
      document.removeEventListener('mousedown', aoInteragirFora);
      document.removeEventListener('click', aoInteragirFora);
      document.removeEventListener('focusin', aoInteragirFora);
      consulta?.removeEventListener('change', aoMudarLargura);
      liberarRolagemDoCorpo();
    };
  }, [aberto, cabecalhoRef, fechar]);

  return { aberto, botaoRef, alternar, fechar };
};
