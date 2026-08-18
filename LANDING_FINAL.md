# A landing

É a raiz do site (`/`). Os vinte protótipos, o seletor de estilos e os
documentos de conceito foram removidos; sobrou a versão escolhida.

```bash
npm run worker:dev   # auditoria em http://localhost:8787
npm run dev          # front em http://localhost:5173
```

Use a porta **5173**. A chave do PageSpeed está restrita por referenciador e só
autoriza `localhost:5173` e `servicos.pedrosatin.com`; o Worker tem a mesma lista
em `ALLOWED_ORIGINS`.

---

## O aparelho e a captura

A barra de status deixou de ser uma faixa preta vazia: mostra hora, sinal, wi-fi
e bateria, com a ilha flutuando ao centro. A hora exibida é a da medição do
Google; antes de rodar a análise, é a hora de abertura da página.

A captura vinha de `final-screenshot`, o quadro final do carregamento, gravado
com compressão alta e por isso ilegível. Passou a vir de `fullPageScreenshot`,
que o Lighthouse entrega em resolução maior, com `final-screenshot` como reserva
caso a resposta não a traga (`pickScreenshot` em `src/lib/sources.ts`). O
aparelho também cresceu de 250 para 290 pixels de largura, o que reduz a
redução de escala aplicada à imagem.

## Revisão antes de publicar

### A página entregava 8 palavras ao robô

Era o defeito mais grave, e o mais constrangedor: uma página que audita
indexação servia `<div id="root"></div>` e nada mais. Todo o texto só existia
depois que 260 KB de JavaScript baixavam e executavam. É o mesmo achado crítico
que a ferramenta reporta para o palpitae.com.br.

O build passou a renderizar o componente em texto (`src/entry-server.tsx` e
`scripts/prerender.mjs`) e o navegador apenas hidrata. **De 8 para 1.820
palavras** no HTML entregue, e o texto agora aparece antes do JavaScript rodar.
O script imprime a contagem no fim do build: se voltar a 8, algo quebrou.

### O que mais faltava para a própria página passar no exame

- **Favicon**: o arquivo existia em `public/` e nunca foi referenciado.
- **Compartilhamento**: não havia og:image. Colar o endereço no WhatsApp dava
  um retângulo vazio. Agora há `public/imagens/compartilhamento.png`,
  regenerável por `scripts/share-image.sh`.
- **`robots.txt` e `sitemap.xml`**: a seção "Como o Google encontra o seu site"
  cobra os dois, e a página não tinha nenhum.
- **Canonical, JSON-LD, theme-color**: ausentes. O JSON-LD descreve o serviço e
  a pessoa, sem endereço e sem avaliação inventada.
- **Cabeçalhos de segurança**: `public/_headers` traz HSTS, CSP, X-Frame-Options,
  Referrer-Policy e Permissions-Policy. A auditoria desconta ponto por HSTS
  ausente, então não tê-lo aqui seria vender o que não se pratica.
- **Fontes**: a folha usa pesos 580, 620 e 650, mas o `index.html` pedia pesos
  fixos, que arredondavam. Passou a pedir o eixo variável. A `JetBrains Mono`,
  citada no CSS, nunca era carregada; agora vem na mesma requisição.

A CSP foi verificada servindo o `dist/` com os cabeçalhos reais e rodando a
análise completa por dentro dela: as cinco etapas concluem e o console fica
limpo.

### Worker

- **SSRF no redirecionamento**: o destino de um redirecionamento é escolhido
  pelo site auditado, e não era revalidado. Um site podia mandar o Worker
  buscar `http://192.168.1.1/`. Cada salto passou a ser conferido.
- **Faixas privadas incompletas**: faltavam `172.16/12`, `0.0.0.0`, IPv6
  único-local e os sufixos `.local` e `.internal`. Lista refeita em
  `isInternalHost`.
- **Origem não conferida no servidor**: o cabeçalho CORS só é obedecido pelo
  navegador, então qualquer página podia usar o endpoint como back-end próprio.
  Agora origem fora da lista recebe 403. Controle de abuso casual, não
  autenticação: um cliente fora do navegador forja a origem.

### Imagens

O retrato de 171 KB e 1377 px era baixado inteiro para desenhar 300 px. Ficou
em `assets-src/`, fora do que se publica, e o site recebe dois recortes prontos:
`retrato.webp` (deitado, 79 KB) e `retrato-quadrado.webp` (fechado no rosto,
17 KB, só para a miniatura em tela estreita). Um `<picture>` baixa apenas um dos
dois. O `icons.svg` órfão, sobra dos protótipos, foi removido.

## Sobre mim na página

Duas entradas, tiradas de `../satinp-portfolio`:

- **Primeira dobra, à direita**: card com a foto, nome, cargo e link para o
  LinkedIn (`https://www.linkedin.com/in/pedro-satin`). A coluna tem os mesmos
  300 px da coluna do aparelho logo abaixo, para o lado direito ficar num eixo
  só. Em tela estreita a foto vira uma faixa 16:9, o que mantém o rosto legível
  sem empurrar o campo de análise para fora da primeira tela.
- **Seção "Quem faz o trabalho"**, entre as condições e os trabalhos: formação,
  Saúde Bliss hoje, Inter (Intershop) antes, docência na UniCesumar, e os links
  para LinkedIn, GitHub e portfólio. O parágrafo do Inter é o que sustenta o
  resto da página: evoluir o SEO da loja é o mesmo ciclo de medir, corrigir e
  conferir que a análise do topo inicia.

O retrato de origem é um corpo inteiro em um parque, e em 300 px o rosto sairia
minúsculo. O recorte é feito no arquivo, não no CSS (ver "Imagens", acima). A
proporção do card foi escolhida medindo: a introdução ao lado tem 302 px, e o
card deitado com legenda fecha em 299, então a primeira dobra não abre vão
embaixo do parágrafo.

## Ajustes da última rodada

- **Aparelho**: o entalhe virou ilha flutuante no estilo dos modelos atuais, e a
  tela reserva a faixa de status, então a captura não fica mais cortada no topo.
- **Extensões de domínio**: as etiquetas "exige OAB", "exige CRM" e as demais
  saíram, junto com a frase que afirmava a mesma coisa. O texto agora diz apenas
  que algumas extensões têm regras próprias de cadastro, verificadas caso a caso.
- **Opções do passo 2**: passaram de linhas irregulares para duas colunas de
  largura igual.
- **Botão do formulário**: alinhado à direita, com a observação à esquerda e uma
  linha separando os campos da ação.
- **Cards de achados**: a etiqueta de severidade fica sempre em linha própria, e
  não mais ao lado do título quando ele é curto.
- **Coluna única**: o aparelho passou a vir depois do terminal, para o scroll
  seguir a ordem da auditoria.

## De onde veio cada parte

| Seção | Origem | O que mudou |
|---|---|---|
| Terminal com log ao vivo | protótipo 4, refeito no 11 | executa a auditoria de verdade, com o comando equivalente e o tempo de cada etapa |
| Aparelho com a captura do site | protótipo 18 | a imagem é a que o Lighthouse devolve, o site renderizado em celular simulado |
| Celular contra computador | protótipo 18 | duas medições do PageSpeed, lado a lado |
| Cards de trabalhos que disparam a análise | protótipo 11 | o botão preenche o campo, roda e leva a página até o terminal |
| Como o Google encontra o site | protótipo 10 | quatro etapas descritas, mais o operador `site:` para conferência |
| Perguntas frequentes | protótipos 2 e 3 | oito perguntas, incluindo cobrança, propriedade do código e assinatura |
| Atendimento em três passos | protótipo 5 | os campos montam a mensagem do WhatsApp, com o diagnóstico junto se houver |
| Código e contas do cliente | protótipo 8 | virou seção própria, "Como o trabalho funciona" |

## O que você pediu e onde está

- **Sob demanda, sem mensalidade** — seção "Como o trabalho funciona" e a
  primeira pergunta do FAQ.
- **Código e contas do cliente** — mesma seção, mais a segunda pergunta.
- **Domínio a partir de R$ 40, sem se limitar ao Registro.br** — a seção de
  domínio diz "a partir de aproximadamente R$ 40 por ano conforme a extensão" e
  registra que fora do `.br` o registro é internacional, com preço próprio.
- **Extensões por profissão** — dezesseis extensões listadas em
  `src/lib/config.ts`, marcando quais exigem conselho de classe (`.adv.br` OAB,
  `.med.br` CRM, `.odo.br` CRO, e assim por diante), com link para o Registro.br.
- **Sem cidade** — "Maringá" saiu do texto do caso do Silva Satin. A barra de
  status diz "atendimento remoto, sob demanda", e há uma pergunta no FAQ sobre
  atendimento presencial.
- **`@pedrosatin` no rodapé** — bloco `lp-signature`, e a terceira pergunta do
  FAQ explica que a remoção é item opcional do orçamento, com acréscimo.
- **WhatsApp** — `+55 44 9165-8870` em `src/lib/config.ts`, propagado para todos
  os botões (e também substituído nos protótipos antigos, que estavam com número
  de exemplo).
- **"O que eu resolvo"** — seis casos, começando por site no ar sem endereço
  próprio, site lento no celular e bugs específicos em site que funciona.

---

## Um defeito encontrado durante a verificação

Rodei a auditoria na própria página, em uma porta que **não** está autorizada
nem no Worker nem na chave do Google. As duas fontes essenciais falharam, e o
placar exibiu **99/100 com zero problemas**.

A causa estava em `scoreFromFindings`: a nota partia de 100 e descontava por
achado. Sem fonte respondendo não há achado, logo não há desconto. É o mesmo
vício do protótipo 4, que reportava `optimal` dentro do `catch`.

A correção introduz cobertura da análise (`AuditCoverage` em `src/lib/types.ts`).
Quando o DNS, a leitura do HTML ou a medição do Google falham, `score` passa a
ser `null` e a página troca o placar por um aviso que nomeia o que não pôde ser
medido. O PageSpeed desligado de propósito (protótipo 14) não conta como falha.

Verificado depois da correção: placar ausente, aviso presente, contadores e
botão de contato preservados.

## Rodada de SEO e independência de terceiros

### As respostas da FAQ não existiam para o Google

A FAQ montava a resposta só quando o item estava aberto (`{open && ...}`). No
HTML entregue havia dez perguntas e uma resposta. Era a parte mais pesquisável
da página — quem digita "quanto custa registrar domínio .br" está fazendo
exatamente uma dessas perguntas — e ela era invisível.

Agora é `<details>`: a resposta fica sempre no HTML, o teclado e o leitor de
tela funcionam sem código, e a abertura funciona com o JavaScript desligado. O
atributo `name` faz o acordeão fechar o item anterior nos navegadores que o
suportam; nos outros, os itens apenas abrem juntos.

**De 1.820 para 3.056 palavras** no HTML entregue.

### Texto em um lugar só

`src/lib/faq.ts` e `src/lib/services.ts` guardam o texto puro. O componente o
renderiza e `src/lib/structuredData.ts` monta com ele o JSON-LD. O Google exige
que a resposta declarada em `FAQPage` seja igual à visível, e declarar texto que
não está na tela é motivo de penalidade — com uma cópia só, isso não tem como
acontecer por descuido.

Os dados estruturados viraram um `@graph` único, com os nós ligados por `@id`:
`WebSite`, `Person`, `ProfessionalService` (com `OfferCatalog` dos seis
serviços), `WebPage`, `FAQPage` com as dez perguntas e `ItemList` dos trabalhos.
Continua sem `aggregateRating`: não existem avaliações públicas, e inventar uma
é penalidade manual além de mentira.

O bloco sai no corpo da página, o que é válido para o schema.org, e por isso vem
junto com o HTML pré-renderizado, em vez de ficar escrito à mão no `index.html`
e envelhecer lá.

### Fontes servidas por este domínio

As duas famílias vinham do Google Fonts: duas conexões a terceiros
(`fonts.googleapis.com` para o CSS, `fonts.gstatic.com` para o arquivo) antes do
primeiro caractere, e uma requisição do visitante a um servidor que ele não
escolheu. Os arquivos variáveis, recorte `latin`, passaram para `src/fontes/`,
com licença e instrução de atualização em `src/fontes/LICENCA.md`. São 79 KB no
total, servidos na conexão já aberta e com o cache permanente de `/assets/`.

`scripts/prerender.mjs` insere o `preload` dos dois arquivos: o nome carrega o
hash do conteúdo e só existe depois do build. Se nenhum `.woff2` aparecer em
`dist/assets/`, o build falha, em vez de publicar a página sem as fontes.

Na CSP, `style-src` e `font-src` passaram a valer só para `'self'`. Não sobrou
requisição a terceiro nenhuma na página.

### Outros itens de SEO

- **`<main>`** envolvendo o conteúdo, separando o corpo da navegação repetida.
- **`max-image-preview:large`** em `robots`, que libera a miniatura grande no
  resultado de busca.
- **`lastmod` no sitemap** reescrito a cada build. Escrito à mão, envelhece e
  passa a mentir para o buscador.
- **Ícone do iOS**: o `apple-touch-icon` apontava para SVG, que o iOS ignora.
  Virou PNG 180x180 com fundo, gerado por `scripts/apple-touch-icon.sh`.
- **`<noscript>`** dizendo o que exatamente precisa de JavaScript: só a análise.
- **Título** com os termos que a página realmente responde, sem virar lista de
  palavras-chave.

### Rodar em qualquer sistema

- **Alvo de build declarado** em `vite.config.ts`, cobrindo navegadores de 2021
  em diante, incluindo o iOS 15 de aparelhos sem atualização — o público lento
  que a página se propõe a medir. O padrão do Vite muda de versão para versão.
- **`-webkit-backdrop-filter`** no cabeçalho fixo: o Safari só aceitou a
  propriedade sem prefixo na versão 18, e sem a linha o cabeçalho ficava opaco.
- **`engines` e `.nvmrc`** declarando Node 22.6, que é o mínimo para o servidor
  local do Worker executar TypeScript sem compilar.

### Dependências e rigor de tipos

TypeScript 7, `@types/node` alinhado ao Node 22 que roda de fato (estava em 24),
`wrangler` 4.124 e `@cloudflare/workers-types` 5.

O `tsconfig.app.json` **não tinha `strict`** — o do Worker tinha. Ligado, junto
com `noUncheckedIndexedAccess` e `noImplicitOverride`: um erro real apareceu, um
`policyMatch[1]` sem verificação em `sources.ts`. Novo comando `npm run
typecheck` cobre o site e o Worker.

O `worker/dev-server.mjs` tinha a lista de origens copiada do `wrangler.toml`.
Agora lê o arquivo: duas cópias divergiriam, e o sintoma seria a análise
funcionando em desenvolvimento e recusada em produção.

### Verificado

`npm run build`, `npm run typecheck` e `npx oxlint` limpos. No Chromium, com o
`dist/` servido sob os cabeçalhos reais: fontes carregadas do próprio domínio,
um `<h1>`, `<main>` presente, nenhuma imagem sem `alt`, sem rolagem horizontal,
acordeão exclusivo funcionando, console limpo — nenhuma violação de CSP, nenhum
aviso de hidratação. A auditoria completa rodou por dentro dessa CSP: cinco
etapas concluídas, captura presente, sete achados, desempenho 93 no celular.

---

## Medições reais feitas na página

| | silvasatin.adv.br | palpitae.com.br |
|---|---|---|
| Índice geral | 78/100 | 70/100 |
| Desempenho celular / computador | 71 / — | 85 / 98 |
| Dados de campo (CrUX) | sem amostra | 2,0 s no percentil 75 |
| Captura do site | sim | sim |
| Achado de maior peso | LCP de 5,6 s no celular | 8 palavras no HTML inicial |

---

## Limpeza feita

Removidos: `src/prototypes/` (os vinte), `src/components/` (usados só por eles),
`src/App.css`, `src/lib/narrative.ts`, `src/assets/`, `DESIGN_CONCEPTS.md` e
`DESIGN_CONCEPTS_V2.md`. O `src/index.css` ficou só com o reset e a tipografia
base. `App.tsx` renderiza a landing direto, sem roteamento.

As dependências `lucide-react` e `canvas-confetti` saíram do `package.json`
porque só os protótipos as usavam. Rode `npm install` para sincronizar o
`node_modules`.

## Antes de publicar

O passo a passo está no `README.md`. O que exige decisão sua:

- **`ALLOWED_ORIGINS`** em `worker/wrangler.toml` precisa das origens finais.
  Agora o Worker recusa o que não estiver lá, então a lista errada quebra a
  análise em vez de apenas deixá-la aberta.
- **`connect-src` em `public/_headers`** hoje libera `https://*.workers.dev`.
  Se o Worker for para um domínio próprio, troque; senão a leitura do HTML
  falha em silêncio e a página passa a exibir "análise incompleta".
- **A chave do PageSpeed vai no pacote do navegador**, por ser `VITE_*`. Está
  protegida por restrição de referenciador, o que resolve o uso indevido. Se
  preferir tirá-la do navegador, dá para mover a chamada para o Worker e guardar
  a chave como secret; nesse caso a restrição da chave precisa passar de
  "Websites" para "None", porque chamada de servidor não envia referenciador.
- **Rode a análise na própria página depois de publicada.** É o teste que
  importa: a ferramenta e o site que a hospeda medidos pelo mesmo critério.
