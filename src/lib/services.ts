export const NEEDS = {
  publicar: 'Fiz um projeto com IA e não sei como publicar',
  bugs: 'Meu projeto feito com IA está com bugs ou travou',
  integrar: 'Preciso integrar banco de dados, login ou pagamentos',
  lento: 'Meu site feito com IA está lento ou quebrado no celular',
  produto: 'Quero transformar meu protótipo de IA em um produto real',
  google: 'Quero que meu site apareça no Google',
  naoSei: 'Ainda não sei, quero uma avaliação técnica',
} as const;

export const NEED_OPTIONS: string[] = Object.values(NEEDS);

export interface ServiceItem {
  title: string;
  short: string;
  body: string;
  need: string;
}

export const SERVICES: ServiceItem[] = [
  {
    title: 'Deploy e domínio próprio',
    short: 'Publicação de projetos do Cursor, Lovable, v0 ou Bolt na Vercel, Cloudflare ou AWS com DNS e SSL no seu nome.',
    body: 'Publicação de aplicações em ambientes de produção como Vercel, Cloudflare Pages ou AWS. Configuração de DNS no Registro.br ou provedor internacional com certificado SSL ativo. Contas e domínio sempre no seu nome.',
    need: NEEDS.publicar,
  },
  {
    title: 'Correção de bugs e código travado',
    short: 'Correção de erros de estado, loops, quebras no celular e travamentos que o chat da IA não resolveu.',
    body: 'Identificação da causa raiz em código TypeScript e React gerado por IA. Correção pontual de loops de renderização, estados dessincronizados e botões quebrados no celular, sem precisar refazer o projeto do zero.',
    need: NEEDS.bugs,
  },
  {
    title: 'Banco de dados e autenticação',
    short: 'Conexão com Supabase, Firebase ou PostgreSQL, autenticação de usuários e fluxo seguro de login.',
    body: 'Transformação de protótipos de tela em sistemas funcionais com persistência real. Modelagem de tabelas no PostgreSQL ou Supabase, login seguro (Google, e-mail e senha) e regras de proteção de dados.',
    need: NEEDS.integrar,
  },
  {
    title: 'Pagamentos e integrações',
    short: 'Integração de Stripe, Asaas ou Mercado Pago via Pix e cartão com liberação automática por webhooks.',
    body: 'Cobrança por assinatura ou pagamento único no Pix e cartão. Configuração de webhooks para liberação imediata de acesso no banco de dados e integração de APIs externas para sua regra de negócio.',
    need: NEEDS.integrar,
  },
  {
    title: 'Performance e Core Web Vitals',
    short: 'Remoção de dependências pesadas de IA, carregamento rápido no celular e notas altas no PageSpeed.',
    body: 'Limpeza de pacotes redundantes inseridos por geradores de código, otimização de imagens e fontes. Carregamento rápido no celular e pontuação alta nas métricas oficiais do Google.',
    need: NEEDS.lento,
  },
  {
    title: 'SEO técnico e indexação',
    short: 'Renderização do HTML inicial, metadados Open Graph para redes sociais, sitemap e robots.txt.',
    body: 'Estruturação de HTML semântico e pré-renderização estática para o Google indexar o conteúdo real em vez de uma tela em branco. Metadados para compartilhamento no WhatsApp e LinkedIn.',
    need: NEEDS.google,
  },
];
