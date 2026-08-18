/**
 * Entrada usada apenas na geração do HTML estático, durante o build.
 *
 * Sem ela o servidor entrega `<div id="root"></div>` e mais nada: o texto da
 * página só existe depois que o JavaScript baixa e executa. É exatamente o
 * defeito que a auditoria desta página aponta nos sites analisados, e seria
 * constrangedor cometê-lo aqui. O mesmo componente que roda no navegador é
 * renderizado em texto na hora do build e o cliente apenas hidrata o resultado.
 */

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.tsx';

export const render = (): string =>
  renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
