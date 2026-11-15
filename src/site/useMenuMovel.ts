import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Largura mínima em que o menu fixo de telas largas substitui o painel. */
const CONSULTA_DESKTOP = '(min-width: 901px)';

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
 * que a página extensa role por baixo do fundo escurecido. Ao fechar por clique
 * num link, o travamento sai de forma síncrona antes da navegação por âncora.
 */
export const useMenuMovel = (cabecalhoRef: RefObject<HTMLElement | null>) => {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const fechar = useCallback((): void => {
    liberarRolagemDoCorpo();
    setAberto(false);
  }, []);

  const alternar = useCallback((): void => {
    setAberto((atual) => {
      const proximo = !atual;
      if (proximo) {
        travarRolagemDoCorpo();
      } else {
        liberarRolagemDoCorpo();
      }
      return proximo;
    });
  }, []);

  useEffect(() => {
    if (!aberto) return;

    travarRolagemDoCorpo();

    const aoPressionarTecla = (evento: KeyboardEvent): void => {
      if (evento.key !== 'Escape') return;
      fechar();
      botaoRef.current?.focus();
    };

    const aoClicarFora = (evento: Event): void => {
      const alvo = evento.target as Node | null;
      if (!alvo || cabecalhoRef.current?.contains(alvo)) return;
      fechar();
    };

    const aoRedimensionar = (): void => {
      if (typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_DESKTOP).matches) {
        fechar();
      }
    };

    document.addEventListener('keydown', aoPressionarTecla);
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('click', aoClicarFora);
    window.addEventListener('resize', aoRedimensionar);

    return () => {
      document.removeEventListener('keydown', aoPressionarTecla);
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('click', aoClicarFora);
      window.removeEventListener('resize', aoRedimensionar);
      liberarRolagemDoCorpo();
    };
  }, [aberto, cabecalhoRef, fechar]);

  return { aberto, botaoRef, alternar, fechar };
};
