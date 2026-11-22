# Fontes self-hosted com `font-display: swap`

Google Fonts acrescentava duas conexões de terceiros antes do primeiro caractere e uma requisição que o visitante não escolheu.

**Decisão:** Inter e JetBrains Mono (variáveis, recorte `latin`, SIL OFL) saem de `src/fontes/` no mesmo origin, com cache permanente em `/assets/`. A folha usa eixos 580/620/650; `font-display: swap` evita o flash de texto invisível. O preload no prerender e o hash do CSS embutido (`inlineStyles`) usam os mesmos bytes autorizados pela CSP.

**Consequências:** atualizar a fonte é commit + rebuild; não há fallback automático a um CDN externo.
