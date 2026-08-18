/**
 * Os problemas que a seção "O que eu resolvo" lista.
 *
 * Ficam aqui, e não no JSX, porque a mesma lista descreve o catálogo de
 * serviços nos dados estruturados (`structuredData.ts`). Texto declarado ao
 * buscador que não corresponde ao texto exibido é justamente o que o Google
 * penaliza, e manter uma cópia só é a maneira de isso não acontecer.
 */
export interface ServiceItem {
  /** Vira o `<h3>` do card e o nome da oferta. */
  title: string;
  /** Frase curta usada nos dados estruturados, onde não cabe o parágrafo. */
  short: string;
  body: string;
}

export const SERVICES: ServiceItem[] = [
  {
    title: 'Site no ar, mas sem endereço próprio',
    short: 'Registro de domínio próprio e migração do site para ele, sem perder o que já existe.',
    body: 'É comum ver um site funcionando em um endereço de plataforma, com sufixo de construtor ou de hospedagem gratuita no meio. Ele até abre, mas passa impressão de improviso, atrapalha a indexação e não pode ser levado embora se você trocar de serviço. Eu registro o domínio no seu nome, aponto o DNS e coloco o site nele, sem perder o que já existe.',
  },
  {
    title: 'Site lento, principalmente no celular',
    short: 'Correção de desempenho no celular, guiada pela medição do PageSpeed Insights.',
    body: 'Imagem pesada demais, script que trava a exibição, tema com recursos que a página não usa. O dono abre no computador com internet boa e acha que está tudo certo, enquanto o cliente espera segundos numa rede móvel e desiste. A medição do Google nesta página aponta onde está o peso, e é por ali que eu começo.',
  },
  {
    title: 'Bugs específicos em site que funciona',
    short: 'Conserto pontual de formulário, botão, layout ou página quebrada, com orçamento fechado.',
    body: 'Formulário que não envia, botão que não responde no telefone, layout que quebra em uma tela, página que some da busca depois de uma atualização. Não é caso de refazer o site inteiro. É caso de achar a causa e corrigir aquele ponto, e é um trabalho que dá para orçar fechado.',
  },
  {
    title: 'Site que não aparece no Google',
    short: 'Diagnóstico e correção de indexação: rastreamento, sitemap e conteúdo visível ao robô.',
    body: 'Às vezes o motivo é banal: um arquivo bloqueando o rastreamento, ausência de sitemap, conteúdo que só existe depois que o JavaScript roda. A análise verifica esses pontos e o próprio visitante pode conferir o resultado no operador de busca, sem depender da minha palavra.',
  },
  {
    title: 'Site novo, do zero',
    short: 'Site institucional ou landing page em código, com domínio próprio e certificado.',
    body: 'Página institucional ou landing page construída em código direto, sem construtor pesado por trás. Vai ao ar com domínio próprio, certificado de segurança e estrutura preparada para o Google ler desde o primeiro dia.',
  },
  {
    title: 'Domínio, e-mail e publicação',
    short: 'Domínio, DNS, certificado, e-mail no endereço próprio e publicação, em contas suas.',
    body: 'Registro do domínio, apontamento de DNS, certificado, e-mail no seu próprio endereço e publicação. Tudo criado em contas suas, que ficam com você no fim do trabalho.',
  },
];
