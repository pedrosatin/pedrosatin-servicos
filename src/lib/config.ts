/** Configuração central usada por todos os protótipos e pela landing final. */

export const CONTACT = {
  /** WhatsApp empresarial. */
  whatsapp: '554491658870',
  whatsappDisplay: '+55 44 9165-8870',
  name: 'Pedro Satin',
  handle: '@pedrosatin',
};

/** Endereço público da página, usado nas metatags e no sitemap. */
export const SITE_URL = 'https://servicos.pedrosatin.com';

/**
 * Dados pessoais exibidos na página. `retrato.webp` é o recorte vertical de
 * `pedrosatin.webp`, já no tamanho em que aparece na tela: assim o navegador
 * não baixa 171 KB para desenhar 300 px de largura.
 */
export const PROFILE = {
  photo: '/imagens/pedro-satin-linkedin.webp',
  /** Recorte fechado no rosto, para a miniatura em telas estreitas. */
  photoSquare: '/imagens/pedro-satin-linkedin-quadrado.webp',
  photoAlt: 'Pedro Satin, engenheiro de software',
  linkedin: 'https://www.linkedin.com/in/pedro-satin',
  github: 'https://www.github.com/pedrosatin',
  portfolio: 'https://pedrosatin.com',
  role: 'Engenheiro de software e tecnologias emergentes',
};

/**
 * Sem `VITE_AUDIT_ENDPOINT` a leitura do HTML não tem para onde ir. O padrão
 * aponta para o servidor local em vez de um endereço publicado inventado: em
 * desenvolvimento funciona, e em produção mal configurada a falha aparece já
 * na primeira análise, em vez de virar um erro silencioso de rede.
 */
export const AUDIT_ENDPOINT: string =
  import.meta.env.VITE_AUDIT_ENDPOINT ?? 'http://localhost:8787';

export const PAGESPEED_KEY: string | undefined = import.meta.env.VITE_PSI_KEY;

export interface CaseStudy {
  domain: string;
  name: string;
  segment: string;
  summary: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    domain: 'servicos.pedrosatin.com',
    name: 'Pedro Satin: Serviços',
    segment: 'Esta própria página',
    summary: 'Auditoria técnica em tempo real, sem scripts bloqueantes e 100 de performance no Google.',
  },
  {
    domain: 'pedrosatin.com',
    name: 'Pedro Satin',
    segment: 'Portfólio de engenharia',
    summary: 'Site pessoal em Astro, HTML estático servido por CDN e indexado no Google.',
  },
  {
    domain: 'silvasatin.adv.br',
    name: 'Silva Satin Advocacia',
    segment: 'Site institucional',
    summary: 'Site institucional com domínio .adv.br próprio, 100% responsivo e indexado na busca.',
  },
  {
    domain: 'palpitae.com.br',
    name: 'Palpitaê',
    segment: 'Aplicação web',
    summary: 'Plataforma de bolões de futebol em Vite e Cloudflare com domínio próprio.',
  },
];

/** Extensões .br mais comuns para aplicações, empresas e profissionais. */
export interface DomainExtension {
  suffix: string;
  audience: string;
}

export const DOMAIN_EXTENSIONS: DomainExtension[] = [
  { suffix: '.com.br', audience: 'Empresas, startups e comércio em geral' },
  { suffix: '.app.br', audience: 'Aplicativos, MVPs e produtos digitais' },
  { suffix: '.dev.br', audience: 'Desenvolvedores e projetos de tecnologia' },
  { suffix: '.adv.br', audience: 'Advogados e escritórios de advocacia' },
  { suffix: '.med.br', audience: 'Médicos e clínicas de saúde' },
  { suffix: '.srv.br', audience: 'Prestadores de serviços em geral' },
];

export const REGISTRO_BR_URL = 'https://registro.br/dominio/categorias/';

export const buildWhatsAppUrl = (message: string): string =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
