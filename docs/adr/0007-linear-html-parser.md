# Parser HTML linear no Worker

O HTML auditado é controlado pelo alvo. Regex com flag `g` do tipo `<meta\b[^>]*>` ou `<script>[\s\S]*?</script>` recomeçam a busca a cada posição: em documentos adversariais o custo vira quadrático (100 KB custavam segundos de CPU).

**Decisão:** `worker/src/parse.ts` faz varredura linear — acha o começo da tag com regex de custo constante e o resto com `indexOf`; quando um `>` ou fechamento não existe a partir de um ponto, a busca para. Cache de RegExp por nome de tag. `detectPlatform` é a única leitura no HTML cru (CMS deixam assinatura em comentários); o restante estrutural usa markup sem comentários. Limites de profundidade em JSON-LD evitam corpos feitos para gastar CPU. O módulo fica separado do handler para rodar em Node nos testes.

**Consequências:** equivalência com as regex antigas é contrato dos testes de desempenho; voltar a `match`/`replace` globais reabre o vetor de CPU.
