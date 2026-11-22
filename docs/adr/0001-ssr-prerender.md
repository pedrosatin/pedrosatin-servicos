# Pré-renderização SSR da landing

A landing é um SPA React, mas o HTML servido no primeiro byte já contém o texto completo das seções permanentes. Sem isso o servidor entregaria só `<div id="root"></div>` — o mesmo defeito que a auditoria aponta nos sites analisados.

**Decisão:** `src/entry-server.tsx` renderiza `LandingPage` em texto no build; `scripts/prerender.mjs` injeta o HTML em `dist/index.html`, gera `dist/404.html` pela mesma casca (`scripts/notFoundPage.mjs`) e falha se o marcador de hidratação sumir. `ssrCompleto` é a lista única do que o HTML pré-renderizado precisa ter; o aviso noscript em `index.css` / `index.html` cobre visitantes sem JavaScript. Substituições no HTML usam função em `String.replace` para não expandir `$&` / `$1`.

**Consequências:** o bundle de hidratação só anima o que já está no DOM; a análise interativa continua dependente de script. Mudar o marcador ou a lista de seções quebra o build de propósito.
