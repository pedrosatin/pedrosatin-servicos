# Worker como proxy com SSRF fechado e host allowlist

O navegador não lê HTML de terceiros (same-origin). Um Worker que busca URLs pedidas pelo cliente vira proxy de varredura se alcançar redes internas ou atender hosts fora do WAF.

**Decisão:**
- Produção: só `servicos-api.pedrosatin.com` (`workers_dev`/`preview_urls` desligados; `ALLOWED_HOSTS` / `ALLOWED_ORIGINS` no `wrangler.toml`).
- Entrada do runtime: `worker/src/worker.ts` reexporta só o handler; `index.ts` exporta helpers para testes.
- Destinos: bloqueio de nomes/IPs internos; host canônico via parser de URL; sitemap só no apex/`www` do alvo (sem PSL, subdomínios de plataforma ficam de fora).
- Dev Node: `dev-dispatcher.mjs` resolve via DoH público e recusa IP privado; porta sentinela 65535 evita a bad-port list do Fetch antes do dispatcher; hosts/origens lidos do `[env.dev.vars]`, sem segunda cópia.

**Consequências:** preview `workers.dev` não serve auditoria. Testes cobrem restrições do runtime que o Node aceitaria. Divergir listas entre dev e produção faz a análise passar local e falhar publicado.
