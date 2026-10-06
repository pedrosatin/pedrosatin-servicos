# Worker de auditoria

Endpoint que a landing page usa para analisar o site de um visitante.

## Por que existe

O navegador não consegue ler o HTML de outro domínio. A política de mesma origem
bloqueia a leitura da resposta a menos que o site de destino envie
`Access-Control-Allow-Origin`, o que sites institucionais praticamente nunca fazem
(verificado em `oab.org.br`, `gov.br` e `uol.com.br` — todos sem o cabeçalho).

Sem este Worker, um analisador no navegador só consegue disparar a requisição e
receber uma resposta opaca: nada de status, cabeçalhos ou conteúdo. Qualquer
"resultado" exibido nessa condição seria inventado.

## Rodar localmente

```bash
cd worker
npm install
npm run dev        # http://localhost:8787/audit?url=silvasatin.adv.br
```

## Publicar

```bash
npm run deploy
```

Depois de publicar, aponte o front para a URL do Worker criando um `.env` na raiz
do projeto:

```
VITE_AUDIT_ENDPOINT=https://pedrosatin-audit.<seu-subdominio>.workers.dev
```

## O que a rota devolve

`GET /audit?url=exemplo.com.br`

- Cadeia completa de redirecionamentos e se `http://` força HTTPS
- Cabeçalhos de cache, compressão e segurança (HSTS, CSP, X-Frame-Options, ...)
- `title`, `meta description`, `canonical`, `viewport`, `lang`, H1/H2
- Imagens sem `alt` e sem `width`/`height` (origem de layout shift)
- Scripts bloqueantes, folhas de estilo, CSS embutido
- Open Graph, Twitter Card e tipos de JSON-LD
- Plataforma detectada (WordPress, Wix, Shopify, Next.js, ...)
- `robots.txt` (inclusive se bloqueia o site inteiro) e `sitemap.xml`
- Contagem de palavras do HTML inicial — revela sites que dependem de
  JavaScript para exibir conteúdo

## PageSpeed e limites HTTP

`GET /pagespeed?domain=exemplo.com.br&strategy=mobile` usa a mesma lista de
origens e limite por IP da auditoria. A chave opcional PSI_KEY fica no Worker.
Configure com `npx wrangler secret put PSI_KEY`; para wrangler dev, use .dev.vars.
O servidor Node local aceita PSI_KEY do ambiente e escuta somente em 127.0.0.1.

Todas as saídas HTTP da auditoria verificam DNS público, protocolo e redirects.
DNS inconclusivo recusa o destino. O Worker usa fetch da plataforma, que bloqueia
redes privadas; a verificação DoH não fixa o IP usado pelo resolver de fetch.
O teto de leitura é 3 MB para HTML, 128 KB para robots e 1 MB para cada sitemap.
Cada cadeia tem até seis requests e deadline de 12 segundos para headers e body.
O proxy PageSpeed usa destino fixo do Google, até 12 MB e 45 segundos.

O limite de dez requests por minuto é por IP e por isolate do Worker. Ele reduz
abuso casual; a cota no provedor deve limitar gastos globais, porque origens
HTTP podem ser forjadas e o contador não é compartilhado entre regiões.
