# Nota só com fontes essenciais

Uma análise em que HTML ou PageSpeed falharam produziria nota alta só por não ter achado defeitos.

**Decisão:** `scoreFromFindings` / cobertura em `types.ts` exigem as fontes essenciais. Sem elas a UI diz “sem nota” (`anuncio.ts`). Fontes em `sources.ts` batem em serviços reais via `SourcesDeps` (fake só em teste); falha lança e o orquestrador marca a etapa. Achados só citam medições coletadas (`findings.ts`).

**Consequências:** cobertura incompleta é estado de primeira classe na UI e nos dados estruturados de anúncio. Não inventar valor padrão para `score`.
