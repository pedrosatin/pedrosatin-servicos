/**
 * As perguntas frequentes, em texto puro.
 *
 * Elas não vivem no componente por dois motivos. O primeiro é que a mesma lista
 * alimenta os dados estruturados de `FAQPage` (`structuredData.ts`): o Google
 * exige que a resposta declarada seja igual à visível, e duas cópias divergem
 * mais cedo ou mais tarde. O segundo é que resposta em texto pode ser lida por
 * quem indexa; resposta em JSX, não.
 */
export interface FaqItem {
  q: string;
  /** Um ou mais parágrafos. */
  a: string[];
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Como funciona a cobrança? Existe mensalidade?',
    a: [
      'Não existe mensalidade e não existe contrato de manutenção. O atendimento é sob demanda: eu faço o levantamento do que você precisa, apresento o orçamento daquele trabalho, e o combinado é aquilo. Se meses depois surgir outra necessidade, fazemos um novo levantamento.',
      'O que continua sendo pago periodicamente é o domínio, direto ao órgão de registro, e a hospedagem, quando o projeto exigir uma que não seja gratuita.',
    ],
  },
  {
    q: 'De quem é o código depois da entrega?',
    a: [
      'Seu. O domínio fica no seu CPF ou CNPJ, as contas de hospedagem e de serviços ficam no seu nome, e o código-fonte é entregue a você. Se um dia quiser trabalhar com outra pessoa, ela assume sem depender de mim para liberar acesso a nada. Não uso construtor proprietário que prenda o site a uma plataforma.',
    ],
  },
  {
    q: 'O que é aquela assinatura no rodapé e dá para tirar?',
    a: [
      'Sites entregues levam uma linha discreta de crédito no rodapé, com o meu perfil. Ela pode ser removida: é um item opcional do orçamento, com acréscimo sobre o valor do projeto. Basta pedir no levantamento e eu incluo o valor separado, para você decidir vendo os dois números.',
    ],
  },
  {
    q: 'Quanto custa o domínio?',
    a: [
      'Domínios terminados em .br são registrados no Registro.br, que é o órgão oficial no Brasil, a partir de aproximadamente R$ 40 por ano conforme a extensão escolhida. Fora do .br, como .com e .dev, o registro é feito em registradores internacionais, com preço próprio de cada um. Em todos os casos você paga direto ao registrador e eu não coloco margem sobre isso.',
    ],
  },
  {
    q: 'Você atende presencialmente?',
    a: [
      'O atendimento é remoto, por WhatsApp e chamada de vídeo quando necessário. Isso vale para o levantamento, o acompanhamento durante o desenvolvimento e o suporte depois da entrega.',
    ],
  },
  {
    q: 'Meu site foi feito por outra pessoa. Dá para consertar em vez de refazer?',
    a: [
      'Na maior parte das vezes, sim, e costuma sair mais barato. A análise no topo desta página já mostra boa parte do que está errado. Com base nela eu digo se vale corrigir o que existe ou se refazer sai mais em conta. Se for melhor corrigir, eu corrijo.',
    ],
  },
  {
    q: 'Você garante primeiro lugar no Google?',
    a: [
      'Não, e desconfie de quem garante. Posição na busca depende de concorrência, histórico do domínio e de fatores que ninguém controla. O que eu faço é garantir que o site esteja tecnicamente apto a ser encontrado: rastreável, rápido, legível no celular e com o conteúdo visível ao robô. Sem isso, nenhuma estratégia funciona.',
    ],
  },
  {
    q: 'A análise desta página é real?',
    a: [
      'É. Ela consulta o registro do domínio no RDAP, a configuração de DNS em servidores públicos, o HTML que o seu servidor entrega e a medição do PageSpeed Insights do Google, que inclui os dados de campo de visitantes reais quando existem. Cada achado traz a evidência que o gerou. Quando um dado não pode ser obtido, a página diz isso em vez de estimar um número.',
    ],
  },
  {
    q: 'Em quanto tempo o site fica pronto?',
    a: [
      'Depende do tamanho, e o prazo sai junto com o orçamento, antes de começar. Publicar um site simples com domínio próprio costuma levar poucos dias; corrigir desempenho ou indexação de um site que já existe é normalmente mais rápido, porque o diagnóstico já aponta o que mexer.',
    ],
  },
  {
    q: 'Você trabalha com site de qual tipo?',
    a: [
      'Sites institucionais, páginas de captação, portfólios, catálogos e aplicações web sob medida. O que eu não faço é montar loja em construtor fechado com mensalidade: quando a necessidade é essa, eu digo, em vez de empurrar um projeto que não serve.',
    ],
  },
];
