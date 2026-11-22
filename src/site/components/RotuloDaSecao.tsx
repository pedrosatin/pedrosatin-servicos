import React, { useContext } from 'react';
import { SecoesVisiveisContext } from '../SecoesVisiveisContext';
import { rotuloDaSecao, type IdSecaoDaPagina } from '../secoesDaPagina';

interface RotuloDaSecaoProps {
  id: IdSecaoDaPagina;
}

export const RotuloDaSecao: React.FC<RotuloDaSecaoProps> = ({ id }) => {
  const visiveis = useContext(SecoesVisiveisContext);
  return (
    <p className="lp-eyebrow lp-section-label" aria-hidden="true">
      {rotuloDaSecao(id, visiveis)}
    </p>
  );
};
