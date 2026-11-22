import { useEffect, useRef } from 'react';

export const PROPRIEDADE_ALTURA_CABECALHO = '--lp-header-h';

export const useAlturaDoCabecalho = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const raiz = document.documentElement;
    const publicar = (): void => {
      raiz.style.setProperty(PROPRIEDADE_ALTURA_CABECALHO, `${elemento.offsetHeight}px`);
    };

    publicar();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', publicar);
      return () => {
        window.removeEventListener('resize', publicar);
        raiz.style.removeProperty(PROPRIEDADE_ALTURA_CABECALHO);
      };
    }

    const observador = new ResizeObserver(publicar);
    observador.observe(elemento);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty(PROPRIEDADE_ALTURA_CABECALHO);
    };
  }, []);

  return ref;
};
