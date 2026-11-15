import React, { useContext } from 'react';
import { SecoesVisiveisContext } from '../SecoesVisiveisContext';
import { rotuloDaSecao, type IdSecaoDaPagina } from '../secoesDaPagina';

interface RotuloDaSecaoProps {
  id: IdSecaoDaPagina;
}

/**
 * Rótulo numerado exibido acima do `h2` de cada seção da página.
 *
 * Recebe `aria-hidden="true"` para que o leitor de tela anuncie apenas o
 * título real da seção no `h2`, evitando a leitura literal de dígitos e barras
 * a cada salto de cabeçalho.
 */
export const RotuloDaSecao: React.FC<RotuloDaSecaoProps> = ({ id }) => {
  const visiveis = useContext(SecoesVisiveisContext);
  return (
    <p className="lp-eyebrow lp-section-label" aria-hidden="true">
      {rotuloDaSecao(id, visiveis)}
    </p>
  );
};
