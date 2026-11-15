import { createContext } from 'react';
import { IDS_DA_PAGINA, type IdSecaoDaPagina } from './secoesDaPagina';

/**
 * Lista ordenada das seções visíveis na página. Quando uma seção é renderizada
 * fora da árvore de `LandingPage`, o contexto usa a lista completa para que o
 * rótulo continue consistente com `rotuloDaSecao`.
 */
export const SecoesVisiveisContext = createContext<readonly IdSecaoDaPagina[]>(IDS_DA_PAGINA);
