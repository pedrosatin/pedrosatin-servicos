# Tipos de auditoria em `shared/` sem runtime

O payload de `GET /audit` era tipado em duplicata no Worker e no front; nada acusava divergência.

**Decisão:** `shared/report-types.ts` é a fonte única (`interface`/`type` apenas). Front e Worker importam com `import type`. O Worker reexporta a partir de `worker/src/parse.ts` para não quebrar imports existentes; no front, `ContentReport` é o nome local do `AuditResponse`.

**Consequências:** mudar um campo quebra o `typecheck` dos dois lados ao mesmo tempo. Zero bytes de runtime cruzam o boundary do deploy do Worker.
