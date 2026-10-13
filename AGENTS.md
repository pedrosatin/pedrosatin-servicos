# Instruções para agentes

## Arquitetura e Ponteiros

- **Frontend SPA**: `src/` — React 19 + Vite com pré-renderização estática SSR (`src/entry-server.tsx`).
- **Worker / API**: `worker/` — Cloudflare Worker para auditorias e proxies.
- **Grafo de conhecimento**: `graphify-out/GRAPH_REPORT.md`.

## Comandos canônicos

```bash
npm run check        # Executa lint (oxlint), typecheck (tsc app + worker) e testes (vitest)
npm run lint         # oxlint
npm run typecheck    # tsc -b && tsc -p worker/tsconfig.json --noEmit
npm test             # vitest run
npm run build        # build do client, SSR e prerender
```

## Agent skills

### Issue tracker
Local tracking in Markdown files under `.scratch/<feature>/`.
Interactive dashboard at `.scratch/index.html`.

### Domain docs
Single-context convention (`docs/`).
