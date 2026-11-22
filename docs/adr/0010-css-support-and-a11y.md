# CSS de suporte, contraste e acessibilidade

O público lento que a página mede inclui iPhones em iOS 15 e teclado/leitor de tela.

**Decisão:** contraste de texto e de foco acima do WCAG AA (valores medidos no tema); um só contorno `:focus-visible`; prefixo `-webkit-backdrop-filter` além do padrão; FAQ em `<details>` (HTML indexável, teclado nativo, sem estado React) com marcador CSS prefixado; rodapé usa classe derivada da contagem de seções em vez de `:has()`; `useAlturaDoCabecalho` publica `--lp-header-h` para `scroll-padding-top` (altura real + borda via `offsetHeight`); screenshot do herói só aceita `data:` raster; região `role="status"` montada vazia no SSR; rótulos `NN //` com `aria-hidden`; alvos de toque e quebras de header documentados nos breakpoints móveis.

**Consequências:** subir o `build.target` do Vite pode aposentar o prefixo Safari e o bypass de `:has()`, mas só depois de revalidar o público-alvo.
