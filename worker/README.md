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

`npm run dev` sobe o ambiente `dev` do `wrangler.toml` (`wrangler dev --env dev`),
que atende `localhost` e `127.0.0.1` e aceita as origens de produção e também
`http://localhost:5173` e `http://localhost:4173`. O servidor Node da raiz
(`npm run worker:dev`) lê as mesmas listas de `[env.dev.vars]`. A configuração
de produção (`[vars]`) não aceita localhost. `wrangler dev --env=""` reescreve
a URL para o host da rota de produção e recusa a origem `http://localhost:5173`
com 403, como em produção.

## Hosts atendidos

O handler só responde aos hostnames de `ALLOWED_HOSTS`, lista separada por
vírgula. Em produção (`[vars]`) é só `servicos-api.pedrosatin.com`; no ambiente
`dev`, `localhost` e `127.0.0.1`. Qualquer outro host recebe 404 sem CORS, antes
do limite por cliente e de qualquer subrequest. Sem a variável, ou com curinga,
vale só o domínio de produção.

O ambiente de produção também desliga o `*.workers.dev` (`workers_dev = false`)
e as preview URLs (`preview_urls = false`). A regra de Rate Limiting do WAF
descrita abaixo filtra pelo host do domínio próprio, e um segundo hostname
passaria sem ela.

## Publicar

```bash
npm run deploy     # wrangler deploy --env="", o ambiente de produção
```

O Worker fica só no domínio próprio. Para apontar o front para ele, crie um
`.env` na raiz do projeto:

```
VITE_AUDIT_ENDPOINT=https://servicos-api.pedrosatin.com
```

Trocar de domínio exige mudar a rota em `routes`, o `ALLOWED_HOSTS` de
`[vars]`, a regra do WAF e o `connect-src` de `public/_headers`.

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
  para o Worker antes de publicá-lo. Se o secret do repositório estiver vazio,
  o Worker mantém o valor já cadastrado. Para cadastrar à mão:
  `npx wrangler secret put PSI_KEY --env=""`.
- `wrangler dev`: use `worker/.dev.vars` com `PSI_KEY=<valor>`.
- Servidor Node local (`npm run worker:dev` na raiz): lê `PSI_KEY` do ambiente
  e escuta só em 127.0.0.1.

A chave antiga (`VITE_PSI_KEY`) foi publicada no pacote do navegador e deve
ser revogada no Google Cloud. O deploy não a usa mais nem como reserva. Gere
uma chave nova, restrinja-a à PageSpeed Insights API, defina cota no console,
cadastre-a como `PSI_KEY` e revogue a antiga. Depois apague `VITE_PSI_KEY` dos
secrets do GitHub e das variáveis do Pages.

O Worker guarda cada medição bem-sucedida por 10 minutos, por destino e
estratégia, na memória do isolate. Repetir a mesma medição nesse intervalo não
gasta cota do Google. O cache é por isolate, então outra região ou outro
isolate mede de novo.

### Teto de chamadas ao Google

A cota padrão de uma chave da PageSpeed Insights API é de 25.000 consultas por
dia e 400 a cada 100 segundos, o que dá 240 por minuto. Fonte: [Monitoring
Performance with the PageSpeed Insights
API](https://dev.to/addyosmani/monitoring-performance-with-the-pagespeed-insights-api-33k7),
de Addy Osmani, da equipe do Chrome no Google. As páginas da API em
developers.google.com ([Get Started](https://developers.google.com/speed/docs/insights/v5/get-started),
[referência REST](https://developers.google.com/speed/docs/insights/rest),
[FAQ](https://developers.google.com/speed/docs/insights/faq)) não publicam os
números. O valor que vale para a chave do projeto aparece no Google Cloud
Console, em **APIs e serviços** > **PageSpeed Insights API** > **Cotas**.

O Worker limita as chamadas que saem para o Google
(`PAGESPEED_UPSTREAM_LIMITS` em `src/index.ts`), além do limite por cliente:

| Teto | Valor | Conta |
| :--- | :--- | :--- |
| Por bloco (/48 no IPv6, /24 no IPv4) | 30 por minuto | o mesmo de um cliente sozinho |
| Por isolate | 60 por minuto | 4 isolates × 60 = 240, a janela curta do Google |
| Por isolate | 250 por hora | 4 isolates × 250 × 24 h = 24.000, abaixo das 25.000 diárias |

A conta supõe até quatro isolates recebendo medições ao mesmo tempo: o público
do site está no Brasil e passa por poucos data centers da Cloudflare. Com mais
isolates, o teto real cresce na mesma proporção, e a regra do WAF e o alerta de
cota no Google Cloud ficam como as proteções seguintes.

O teto por bloco fecha o caminho do security audit: 32 /64 de um mesmo /56,
cada um com 30 medições por minuto e query única para escapar do cache, faziam
960 chamadas ao Google. Agora fazem 30.

Só a chamada que sai para o Google conta. Resposta do cache não gasta nenhum
dos tetos. Quando um deles acaba, o visitante recebe a mesma resposta da cota
esgotada no Google, 429 com `{"error":"PageSpeed indisponível."}`, e o Google
não é chamado. O front trata como limite de uso do Google e espera mais entre
as tentativas, que também não saem do Worker enquanto o teto durar. O log
registra `pagespeed upstream cap reached` com o teto que acabou (`bloco`,
`minuto` ou `hora`).

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

Sitemaps só são buscados no host do site auditado ou na variante com ou sem
`www.`, inclusive nos redirecionamentos. Subdomínios e outros domínios ficam de
fora: sem a Public Suffix List não há como separar um subdomínio do próprio
site de outro cliente da mesma plataforma (`*.pages.dev`, `*.github.io`). Para
IP literal, só o próprio IP. Um sitemap citado no `robots.txt` em outro host
não é buscado, e o relatório o marca como não verificado.

Cada auditoria tem teto de 40 subrequests, somando fetches e consultas DoH. Uma
auditoria comum gasta perto de 12. Se a página principal passar do teto, a
resposta traz `ok: false` com a explicação; se o teto acabar durante a
verificação de `robots.txt` e sitemap, o sitemap sai como não verificado.

Erros inesperados (rede, runtime) vão para o log do Worker. O cliente recebe
uma mensagem fixa em português, sem o texto da exceção.

O Worker usa o fetch da plataforma, que já bloqueia redes privadas; a checagem
por DoH não fixa o IP que o fetch vai usar.

Tetos de leitura: 3 MB para HTML, 128 KB para `robots.txt` e 1 MB para cada
sitemap. A cadeia da página principal tem até seis requisições; as de
`robots.txt` e de cada sitemap, até três. Todas têm 12 segundos para
cabeçalhos e corpo. O proxy do PageSpeed tem destino fixo, teto de 12 MB e 45
segundos, e repassa o corpo sem reprocessar o JSON.

O parser de HTML percorre o documento em tempo linear. O HTML vem do site
auditado, e as regex com retrocesso de antes deixavam um documento hostil de
100 KB custar segundos de CPU.

## Limite por cliente

Cada cliente tem, por minuto, 10 requisições para `/audit` e 30 para
`/pagespeed`. IPv4 conta por endereço; IPv6 conta pelo prefixo /64, porque um
provedor entrega um /64 inteiro a cada assinante e trocar de endereço dentro
dele não pode zerar o contador.
Uma auditoria completa faz uma chamada a `/audit` e duas a `/pagespeed`
(celular e computador), e o front repete cada medição até três vezes; o
orçamento separado evita que as medições consumam o limite da auditoria. O 429
do limitador traz `code: "rate_limited"`, e o front mostra uma mensagem própria
em vez de culpar o Google. As medições que saem para o Google passam ainda
pelos tetos por bloco e por isolate de [Teto de chamadas ao
Google](#teto-de-chamadas-ao-google).

Um bloco grosso, o /48 no IPv6 e o /24 no IPv4, abre no máximo 32 contadores
de cliente em cada rota. Os clientes novos do bloco que passam disso dividem um
contador do próprio bloco, com o mesmo limite de um cliente (10 `/audit` e 30
`/pagespeed` por minuto). Quem gira /64 dentro de um /48 gasta só o orçamento
desse /48 e ocupa no máximo 33 entradas por rota.

O contador vive na memória de cada isolate e guarda até 5000 entradas. Quando
enche, as janelas vencidas saem primeiro. Se todas estiverem ativas, o cliente
novo divide o contador do próprio bloco. Se o bloco ainda não tem contador, a
janela mais antiga sai para abrir a vaga, e a tabela não passa de 5000. Um
bloco ocupa no máximo 66 entradas somando as duas rotas, então encher a tabela
exige pelo menos 76 blocos. Nenhum contador é dividido entre blocos.

Esse limite é por isolate: cada data center e cada isolate da Cloudflare
contam à parte, então o limite efetivo fica acima do nominal. Origens HTTP
podem ser forjadas fora do navegador. A proteção forte é uma regra de Rate
Limiting no WAF da Cloudflare, que conta em toda a borda antes de o Worker
rodar:

1. No painel da Cloudflare, abra a zona `pedrosatin.com`.
2. Vá em **Security** > **WAF** > **Rate limiting rules** (no painel novo,
   **Security** > **Security rules** > **Create rule** > **Rate limiting rule**).
3. Dê um nome, por exemplo `servicos-api`.
4. Em **If incoming requests match**, use a expressão
   `(http.host eq "servicos-api.pedrosatin.com")`.
5. Em **With the same characteristics**, deixe **IP**.
6. Em **When rate exceeds**, use 20 requisições a cada 10 segundos. No plano
   Free, o período de 10 segundos e a característica IP são os únicos
   disponíveis. Uma análise completa faz até 7 requisições (uma auditoria e
   duas medições com até três tentativas cada), então esse valor deixa folga
   para uso normal.
7. Em **Then take action**, escolha **Block** com duração de 10 segundos e
   salve com **Deploy**.

A regra não substitui a cota no Google Cloud. Defina um alerta de cota da
PageSpeed Insights API no console do Google.
