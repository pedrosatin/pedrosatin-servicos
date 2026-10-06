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

## PageSpeed

`GET /pagespeed?domain=exemplo.com.br&strategy=mobile` repassa a medição do
PageSpeed Insights. O navegador não recebe a chave: ela fica no secret
`PSI_KEY` do Worker.

`PSI_KEY` é requisito de produção. Sem ela, o Worker usa a cota anônima do
Google, que sai de IPs da Cloudflare compartilhados com outros clientes e
costuma responder 429. Trate a cota anônima só como fallback limitado para
desenvolvimento.

- Produção: o deploy do GitHub Actions copia o secret `PSI_KEY` do repositório
  (ou, enquanto ele não existir, o antigo `VITE_PSI_KEY`) para o Worker antes
  de publicá-lo. Para cadastrar à mão: `npx wrangler secret put PSI_KEY`.
- `wrangler dev`: use `worker/.dev.vars` com `PSI_KEY=<valor>`.
- Servidor Node local (`npm run worker:dev` na raiz): lê `PSI_KEY` do ambiente
  e escuta só em 127.0.0.1.

A chave usada antes desta mudança foi publicada no pacote do navegador. Gere
uma chave nova no Google Cloud, restrinja-a à PageSpeed Insights API, defina
cota no console, cadastre-a como `PSI_KEY` e revogue a antiga. Depois disso,
apague `VITE_PSI_KEY` dos secrets do GitHub e das variáveis do Pages.

## Destinos aceitos

Toda saída HTTP da auditoria (alvo, redirecionamentos, `robots.txt`, sitemaps e
a versão `http://`) passa pela mesma validação:

- só `http:` e `https:`, sem usuário e senha na URL e sem porta customizada
  (`https://exemplo.com:8443` recebe "Domínio inválido");
- nomes como `localhost`, `*.local`, `*.internal` e `*.home.arpa` são recusados;
- o host é resolvido por DoH (A e AAAA) e recusado se algum endereço for
  interno ou reservado: faixas privadas, laço local, link-local, CGNAT
  (100.64.0.0/10), 198.18.0.0/15, multicast, 240.0.0.0/4, IPv6 fora de
  2000::/3 (inclui `::`, `fc00::/7`, `fe80::/10`, `fec0::/10`) e IPv4 embutido
  em `::ffff:`, NAT64 (`64:ff9b::/96`) e 6to4 (`2002::/16`);
- DNS sem resposta conclusiva recusa o destino. Se só uma das consultas (A ou
  AAAA) falhar e a outra trouxer endereços públicos, o destino é aceito.

O resultado do DNS fica guardado por host durante a requisição, então cada host
custa duas consultas por auditoria. Quando a consulta de um sitemap falha por
rede, DNS ou limite de subrequests, o relatório marca o sitemap como não
verificado em vez de ausente.

O Worker usa o fetch da plataforma, que já bloqueia redes privadas; a checagem
por DoH não fixa o IP que o fetch vai usar.

Tetos de leitura: 3 MB para HTML, 128 KB para `robots.txt` e 1 MB para cada
sitemap. Cada cadeia tem até seis requisições e 12 segundos para cabeçalhos e
corpo. O proxy do PageSpeed tem destino fixo, teto de 12 MB e 45 segundos, e
repassa o corpo sem reprocessar o JSON.

## Limite por IP

Cada IP tem, por minuto, 10 requisições para `/audit` e 30 para `/pagespeed`.
Uma auditoria completa faz uma chamada a `/audit` e duas a `/pagespeed`
(celular e computador), e o front repete cada medição até três vezes; o
orçamento separado evita que as medições consumam o limite da auditoria. O 429
do limitador traz `code: "rate_limited"`, e o front mostra uma mensagem própria
em vez de culpar o Google.

O contador vive na memória de cada isolate, guarda até 5000 entradas e descarta
a mais antiga quando enche. Ele limita requisições repetidas de um mesmo IP,
mas não substitui a cota no Google Cloud: origens HTTP podem ser forjadas e o
contador não é compartilhado entre regiões.
