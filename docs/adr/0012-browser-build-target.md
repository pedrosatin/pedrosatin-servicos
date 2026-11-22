# Alvo de build dos navegadores de 2021+

O default do Vite muda entre versões e pode excluir aparelhos que a página se propõe a medir.

**Decisão:** `vite.config.ts` fixa o target em navegadores de 2021 em diante (inclui iOS 15). O JS para em optional chaining e nullish coalescing; o CSS em `gap`, `clamp` e `aspect-ratio`.

**Consequências:** features mais novas exigem polyfill consciente ou revisão deste ADR junto com o público-alvo da auditoria.
