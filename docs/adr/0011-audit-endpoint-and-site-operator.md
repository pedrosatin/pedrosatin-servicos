# Endpoint de auditoria padrão e operador `site:`

Sem `VITE_AUDIT_ENDPOINT`, um padrão “de produção inventado” falharia em silêncio na rede. Contagem de resultados do Google não tem API pública honesta.

**Decisão:** o default de `AUDIT_ENDPOINT` aponta para o servidor local de desenvolvimento; em produção mal configurada a falha aparece na primeira análise. A consulta “quantas páginas o Google conhece” abre o operador `site:` no Google para a pessoa ver o resultado — sem scrapear a SERP.

**Consequências:** deploy precisa definir `VITE_AUDIT_ENDPOINT`. O número de resultados indexados não entra no score automático.
