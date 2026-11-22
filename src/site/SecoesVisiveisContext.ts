import { createContext } from 'react';
import { IDS_DA_PAGINA, type IdSecaoDaPagina } from './secoesDaPagina';

export const SecoesVisiveisContext = createContext<readonly IdSecaoDaPagina[]>(IDS_DA_PAGINA);
