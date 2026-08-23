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
      'Não cobro mensalidade e não exijo contrato de fidelidade. O atendimento é sob demanda. Fazemos o levantamento do que você precisa, apresento o orçamento com valor fechado e prazo definido, e o combinado é cumprido.',
      'Os custos de infraestrutura (domínio no Registro.br e eventuais planos pagos de hospedagem) são pagos diretamente por você aos serviços.',
    ],
  },
  {
    q: 'De quem é o código e as contas após a entrega?',
    a: [
      'Tudo fica no seu nome. O domínio é registrado no seu CPF ou CNPJ, as contas de hospedagem e banco pertencem a você, e o repositório no GitHub é transferido para o seu usuário. Você tem autonomia total para manter ou contratar outros profissionais quando quiser.',
    ],
  },
  {
    q: 'Fiz meu projeto no Lovable, Bolt.new, v0 ou Cursor. Você assume de onde parei?',
    a: [
      'Sim. Você compartilha o repositório no GitHub ou o código exportado. Eu analiso a estrutura, resolvo pendências técnicas e continuo o desenvolvimento ou levo direto para produção.',
    ],
  },
  {
    q: 'O código gerado por IA está com bugs ou travando. Precisa refazer do zero?',
    a: [
      'Na grande maioria dos casos, não. Erros de renderização, loops de reatividade e botões quebrados no celular são pontuais. Eu identifico a causa raiz e corrijo onde está o defeito, o que é muito mais rápido e econômico do que recomeçar.',
    ],
  },
  {
    q: 'Como funciona para colocar domínio próprio e publicar?',
    a: [
      'Você compra o domínio diretamente no Registro.br ou registrador internacional (sem intermediário ou sobretaxa). Eu configuro os apontamentos de DNS, ativo o certificado SSL HTTPS e monto o deploy automático na Vercel, Cloudflare Pages ou AWS.',
    ],
  },
  {
    q: 'Você integra banco de dados (como Supabase) e autenticação?',
    a: [
      'Sim. Conecto bancos relacionais (PostgreSQL via Supabase, Firebase ou Prisma), configuro autenticação de usuários (Google, e-mail e senha) e ligo as tabelas reais aos formulários da aplicação.',
    ],
  },
  {
    q: 'Você garante primeiro lugar no Google?',
    a: [
      'Não, e desconfie de quem promete isso. O posicionamento depende de concorrência e autoridade do domínio. O que eu garanto é a base técnica perfeita: HTML semântico, metadados corretos, sitemap válido, alta velocidade no celular e renderização para o robô da busca indexar seu conteúdo.',
    ],
  },
  {
    q: 'Em quanto tempo o projeto fica pronto?',
    a: [
      'Publicações com domínio próprio e deploy levam de 1 a 3 dias úteis. Correções de bugs ou integrações de banco de dados e pagamentos costumam levar poucos dias. O prazo exato é informado junto com o orçamento antes do início.',
    ],
  },
  {
    q: 'A análise desta página funciona para testar meu projeto de IA?',
    a: [
      'Sim. Se a aplicação já estiver em qualquer endereço público (inclusive links temporários de teste da Vercel, Lovable ou Bolt), a ferramenta no topo mede a velocidade no celular via Google PageSpeed e inspeciona a estrutura do HTML.',
    ],
  },
];
