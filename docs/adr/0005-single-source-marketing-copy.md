# Texto único para UI e dados estruturados

Texto declarado ao buscador que não corresponde ao texto exibido é o que o Google penaliza; cópias de prazo e FAQ divergem cedo.

**Decisão:** FAQ (`faq.ts`), catálogo de serviços (`services.ts`), prazos (`prazos.ts`), navegação (`secoesDoMenu.ts`) e ordem/rótulos de seção (`secoesDaPagina.ts`) vivem em módulos de dados. `structuredData.ts` monta um `@graph` JSON-LD a partir das mesmas fontes. Componentes só consomem; não embutem cópias.

**Consequências:** mudar copy de marketing ou SEO é editar o módulo de dados, não o JSX. Seções condicionais da auditoria entram na numeração só quando visíveis.
