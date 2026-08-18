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
