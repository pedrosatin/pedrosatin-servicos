# Separação de módulos para o pacote inicial

`normalizeDomain` / `isValidDomain` e os rótulos de achados rodam na primeira digitação; o motor de consultas e as regras de `buildFindings` só servem depois que a análise começa.

**Decisão:** `dominio.ts` e `achados.ts` ficam fora de `sources.ts` / `findings.ts` para o import estático da página não arrastar o motor. `useAudit` carrega `audit` sob demanda. `deferredSections` pede os chunks de resultado no início da análise, para falha de preload aparecer antes do veredito (`vite:preloadError` + boundary).

**Consequências:** quem unificar esses módulos de novo incharia o JS de entrada. Testes e callers precisam respeitar as fronteiras de import.
