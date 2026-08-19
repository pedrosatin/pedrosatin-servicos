# servicos.pedrosatin.com

Landing page de captação com auditoria real de sites. React, TypeScript e Vite
no navegador; um Worker da Cloudflare para o que a política de mesma origem
impede o navegador de ler.

```bash
npm install
cp .env.example .env   # preencha VITE_PSI_KEY

npm run worker:dev     # auditoria em http://localhost:8787
npm run dev            # site em http://localhost:5173
```

Use a porta **5173**: a chave do PageSpeed está restrita por referenciador e o
Worker recusa origens fora de `ALLOWED_ORIGINS`.

## Estrutura

```
src/site/      a landing page
src/lib/       motor de auditoria, textos da FAQ e dos serviços, dados estruturados
src/fontes/    Inter e JetBrains Mono servidas por este domínio
src/entry-server.tsx   renderização estática usada no build
scripts/       pré-renderização, imagem de compartilhamento e ícone do iOS
worker/        leitura de HTML, robots.txt e sitemap de terceiros
public/        favicon, robots.txt, sitemap.xml, _headers e imagens
assets-src/    originais que não vão para o site publicado
```

Requer **Node 24 ou mais novo**: é a LTS ativa (Krypton), a versão pedida no
`.nvmrc` e a que a publicação usa. Nela o servidor local do Worker executa
TypeScript direto, sem etapa de compilação e sem flag experimental.

A 26 é Current, não LTS: entra em LTS só em outubro de 2026. Numa página que
vende estabilidade não vale rodar na linha que ainda recebe mudança de
comportamento — em outubro a troca é uma linha no `.nvmrc`.

Detalhes das decisões e das medições em `LANDING_FINAL.md`; requisitos do
projeto em `CONTEXT.md`.

## O HTML sai escrito do build

Uma página de captação que fala de indexação não pode entregar
`<div id="root"></div>` ao robô. O `build` roda duas vezes: a compilação do
cliente e uma de servidor, que renderiza o mesmo componente em texto e injeta o
resultado no `index.html` (`scripts/prerender.mjs`). No navegador o React apenas
hidrata o que já está na tela.

A conferência é o próprio número que o script imprime no fim do build — hoje
cerca de 3.000 palavras. Se voltar a ser 8, algo quebrou.

## Nenhuma requisição a terceiros

A página não carrega nada de servidor que o visitante não escolheu. As fontes
saem de `src/fontes/`, com licença e instrução de atualização em
`src/fontes/LICENCA.md`; não há analytics, tag manager nem widget externo. A CSP
em `public/_headers` é o que garante isso na prática: `style-src` e `font-src`
valem só para `'self'`, e `connect-src` lista uma a uma as fontes de dado que a
análise consulta. Acrescentar um script de terceiro sem mexer lá simplesmente
não funciona, o que é o comportamento desejado.

## Texto único para tela e para buscador

As perguntas (`src/lib/faq.ts`) e os serviços (`src/lib/services.ts`) são texto
puro em um módulo só. O componente renderiza esse texto e
`src/lib/structuredData.ts` monta com ele o JSON-LD (`FAQPage`, `OfferCatalog`,
`Person`, `WebSite`, `WebPage`). O Google exige que a resposta declarada seja a
mesma que aparece na tela, e com uma cópia só isso não tem como divergir.

A FAQ usa `<details>`, não estado do React: a resposta fica sempre no HTML, e
não apenas quando aberta. Antes disso, as respostas — a parte mais pesquisável
da página — não existiam para quem indexa.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | tipos, build do cliente, build de servidor e pré-renderização |
| `npm run preview` | serve `dist/` como em produção |
| `npm run lint` | oxlint |
| `npm run typecheck` | tipos do site e do Worker |
| `npm run worker:dev` | Worker local sem wrangler, na porta 8787 |
| `npm run worker:deploy` | publica o Worker |
| `scripts/share-image.sh` | regera a imagem de compartilhamento (ImageMagick) |
| `scripts/apple-touch-icon.sh` | regera o ícone de tela inicial do iOS |

## Publicar

1. **Worker primeiro.** Ajuste `ALLOWED_ORIGINS` em `worker/wrangler.toml` com
   as origens finais e rode `npm run worker:deploy`. Anote a URL gerada.
2. **Chave do PageSpeed.** No console do Google, deixe na restrição de
   referenciador apenas `servicos.pedrosatin.com/*` e o `localhost:5173` que
   você usa para desenvolver.
3. **Variáveis do site.** No Cloudflare Pages, defina `VITE_AUDIT_ENDPOINT` com
   a URL do Worker e `VITE_PSI_KEY` com a chave. Elas entram no pacote do
   navegador, o que é aceitável porque a chave é restrita por referenciador.
4. **Build e publicação.** Comando `npm run build`, diretório de saída `dist`.
5. **Cabeçalhos.** `public/_headers` já vai junto e traz HSTS, CSP e cache. Ao
   publicar o Worker em domínio próprio, troque `https://*.workers.dev` pelo
   endereço final na diretiva `connect-src`.
6. **Depois de publicado**, rode a análise da própria página em
   `servicos.pedrosatin.com`. É o teste que importa: a ferramenta e o site que
   a hospeda são avaliados pelo mesmo critério.
