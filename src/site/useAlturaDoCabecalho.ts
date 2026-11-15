import { useEffect, useRef } from 'react';

/** Nome da custom property lida pelo `scroll-padding-top` do `html`. */
export const PROPRIEDADE_ALTURA_CABECALHO = '--lp-header-h';

/**
 * Publica a altura real do cabeçalho fixo em `--lp-header-h`, no `<html>`.
 *
 * O `scroll-padding-top` do `html` usa essa propriedade para que links com
 * hash, `/#faq` aberto direto e `scrollIntoView` parem abaixo do cabeçalho. A
 * altura muda com a largura da tela (o botão e o texto quebram em linhas
 * diferentes no celular), então um número fixo no CSS erraria em um dos dois.
 *
 * Na renderização estática o efeito não roda, e o CSS usa o valor de reserva
 * da própria `var()` até o navegador medir.
 */
export const useAlturaDoCabecalho = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const raiz = document.documentElement;
    const publicar = (): void => {
      // `offsetHeight` inclui a borda inferior; o ResizeObserver entrega só o
      // conteúdo, e 1 px a menos já esconderia a borda do título.
      raiz.style.setProperty(PROPRIEDADE_ALTURA_CABECALHO, `${elemento.offsetHeight}px`);
    };

    publicar();

    // Navegadores sem ResizeObserver ficam com a medida inicial e com a
    // atualização no redimensionamento da janela.
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
