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
    title: 'Publicação e deploy com domínio próprio',
    short: 'Deploy de projetos criados em Lovable, v0, Bolt ou Git para Vercel, Cloudflare, VPS ou AWS, com DNS e SSL no seu nome.',
    body: 'Projetos criados em ferramentas como Lovable, v0, Bolt.new ou Cursor costumam ficar restritos a links temporários de teste. Eu levo o código para ambientes de produção como Vercel, Cloudflare Pages, VPS ou AWS, configuro os registros de DNS no Registro.br ou provedor internacional e ativo o certificado SSL. As contas e o domínio ficam no seu nome desde o primeiro dia.',
  },
  {
    title: 'Correção de bugs e código gerado por IA',
    short: 'Correção de erros de estado, loops infinitos, quebras de layout no celular e travamentos que o chat de IA não resolveu.',
    body: 'Aplicações geradas por IA costumam acumular inconsistências difíceis de depurar via prompt: componentes que re-renderizam sem parar, botões que não respondem no celular, variáveis de ambiente expostas ou estados dessincronizados. Eu analiso o repositório, identifico a causa raiz e corrijo os problemas pontualmente sem precisar refazer o projeto do zero.',
  },
  {
    title: 'Banco de dados e autenticação',
    short: 'Conexão com Supabase, Firebase ou PostgreSQL, autenticação de usuários e e-mails transacionais.',
    body: 'Transformação de protótipos visuais de IA em sistemas funcionais com persistência real. Faço a modelagem de tabelas relacionais no PostgreSQL/Supabase ou Firebase, implemento fluxo seguro de cadastro e login de usuários (OAuth, magic link ou e-mail/senha) e configuro envio de e-mails transacionais com Resend ou SendGrid.',
  },
  {
    title: 'Integração de pagamentos e APIs',
    short: 'Adição de Stripe, Asaas, Mercado Pago, webhooks e APIs externas a MVPs e aplicações web.',
    body: 'Cobrança por assinatura, pagamentos únicos no cartão ou Pix integrados com Stripe, Asaas ou Mercado Pago. Configuro os endpoints de webhooks para liberar acessos automaticamente no banco de dados após a confirmação do pagamento, além de integrar APIs externas necessárias para a regra de negócio da aplicação.',
  },
  {
    title: 'Performance e limpeza de código',
    short: 'Remoção de dependências redundantes de IA, redução do tempo de carregamento e notas altas no Core Web Vitals.',
    body: 'Geradores de código frequentemente inserem pacotes redundantes, scripts pesados e estruturas que lentificam o carregamento no celular. Eu faço a limpeza de dependências do bundle JavaScript, ajusto carregamento de fontes e imagens e otimizo métricas de LCP e CLS para garantir pontuação alta no PageSpeed Insights.',
  },
  {
    title: 'SEO técnico e indexação no Google',
    short: 'Estruturação de HTML semântico, metadados Open Graph, sitemap e renderização para indexação no Google.',
    body: 'Aplicações SPA construídas por IA frequentemente entregam um HTML inicial vazio, impedindo que o Google indexe o conteúdo ou que links compartilhem prévias corretas. Eu reestruturo tags semânticas, configuro SSR ou pré-renderização estática, gero sitemap.xml, robots.txt e dados estruturados Schema.org para o robô da busca encontrar e posicionar o site.',
  },
];
