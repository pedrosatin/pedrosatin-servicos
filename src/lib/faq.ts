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
      'Não cobro mensalidade e não exijo contrato de fidelidade. O atendimento é sob demanda: analisamos o que você precisa no projeto, apresento o orçamento com escopo fechado daquele trabalho, e o combinado é cumprido. Se meses depois você precisar de novas funcionalidades ou melhorias, fazemos um novo alinhamento.',
      'Os únicos custos periódicos são os dos provedores da sua escolha (como o domínio no Registro.br e hospedagens que ultrapassarem planos gratuitos), pagos diretamente por você aos serviços.',
    ],
  },
  {
    q: 'De quem é o código e as contas após a entrega?',
    a: [
      'Tudo é seu. O domínio fica registrado no seu CPF ou CNPJ, as contas de hospedagem, banco de dados e plataformas de pagamento ficam no seu nome, e o código-fonte no GitHub é transferido para você. Você tem autonomia total para manter, evoluir ou contratar outro profissional a qualquer momento sem nenhuma dependência de mim.',
    ],
  },
  {
    q: 'Fiz meu projeto no Lovable, Bolt.new, v0 ou Cursor. Você consegue assumir de onde parei?',
    a: [
      'Sim. Você pode me conceder acesso ao repositório no GitHub ou exportar o código gerado. Eu analiso a estrutura existente, verifico as dependências, resolvo as pendências técnicas e continuo o desenvolvimento ou levo a aplicação para produção.',
    ],
  },
  {
    q: 'O código gerado por IA está com bugs ou travando. Precisa refazer do zero?',
    a: [
      'Na grande maioria dos casos não é necessário refazer do zero. Erros de renderização, loops de reatividade, falhas de sincronização de estado ou formulários quebrados costumam ser pontuais. Eu identifico a causa raiz e corrijo onde está o problema, o que sai mais rápido e mais barato do que recomeçar.',
      'Se após a análise técnica for constatado que a base está inviável, eu aviso com transparência antes de qualquer decisão.',
    ],
  },
  {
    q: 'Como funciona para colocar domínio próprio e publicar?',
    a: [
      'Eu oriento a compra do domínio diretamente no Registro.br ou registrador internacional (sem taxa adicional sobre o domínio). Em seguida, configuro os registros de DNS, ativo o certificado SSL HTTPS e configuro o pipeline de deploy em plataformas como Vercel, Cloudflare Pages, VPS ou AWS, com publicação automática a cada atualização no repositório.',
    ],
  },
  {
    q: 'Você integra banco de dados (como Supabase) e login no meu projeto de IA?',
    a: [
      'Sim. Projetos gerados em ferramentas visuais costumam usar dados mockados em memória. Eu integro bancos relacionais (PostgreSQL via Supabase, Firebase ou Prisma), defino esquemas e regras de segurança (RLS), configuro autenticação de usuários (OAuth, magic link ou e-mail/senha) e ligo formulários e tabelas.',
    ],
  },
  {
    q: 'Você garante primeiro lugar no Google?',
    a: [
      'Não, e você deve desconfiar de quem promete isso. Posicionamento na busca depende de histórico do domínio, concorrência e autoridade, fatores que ninguém controla. O que eu garanto é a excelência técnica: código semântico, metadados corretos, sitemap válido, alta velocidade de carregamento no celular e renderização adequada para que o robô do Google leia o conteúdo.',
    ],
  },
  {
    q: 'A análise desta página funciona para testar meu projeto de IA?',
    a: [
      'Sim. Se a sua aplicação já estiver disponível em qualquer endereço público (inclusive links temporários de teste da Vercel, Lovable ou Bolt), a ferramenta no topo desta página mede a velocidade de carregamento em aparelho móvel real via PageSpeed do Google e inspeciona o HTML retornado.',
    ],
  },
  {
    q: 'Em quanto tempo o projeto fica pronto?',
    a: [
      'Depende do escopo definido. Publicações com apontamento de domínio próprio e deploy levam de 1 a 3 dias úteis. Correções de bugs ou integrações de banco de dados e pagamentos em MVPs costumam levar de poucos dias a uma semana. O prazo exato é informado junto com o orçamento antes de iniciar o trabalho.',
    ],
  },
  {
    q: 'Com que tipos de tecnologias você trabalha?',
    a: [
      'Trabalho principalmente com TypeScript e o ecossistema web moderno: React, Next.js, Vite e Node.js no desenvolvimento; Supabase, Firebase e PostgreSQL para persistência; Vercel, Cloudflare, VPS e AWS para infraestrutura e deploy; Stripe, Asaas e Mercado Pago para pagamentos.',
    ],
  },
];
