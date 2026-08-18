/** Configuração central usada por todos os protótipos e pela landing final. */

export const CONTACT = {
  /** WhatsApp empresarial. */
  whatsapp: '5544991658870',
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
  photo: '/imagens/retrato.webp',
  /** Recorte fechado no rosto, para a miniatura em telas estreitas. */
  photoSquare: '/imagens/retrato-quadrado.webp',
  photoAlt: 'Pedro Satin, engenheiro de software',
  linkedin: 'https://www.linkedin.com/in/pedro-satin',
  github: 'https://www.github.com/pedrosatin',
  portfolio: 'https://pedrosatin.com',
  role: 'Engenheiro de software',
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
    domain: 'pedrosatin.com',
    name: 'Pedro Satin',
    segment: 'Portfólio de engenharia',
    summary: 'Site pessoal em Astro, HTML estático servido por CDN e indexado no Google.',
  },
  {
    domain: 'silvasatin.adv.br',
    name: 'Silva Satin Advocacia',
    segment: 'Escritório de advocacia',
    summary: 'Site institucional com domínio .adv.br próprio, responsivo e presente na busca.',
  },
  {
    domain: 'palpitae.com.br',
    name: 'Palpitaê',
    segment: 'Aplicação web',
    summary: 'Plataforma de bolões de futebol em Vite e Cloudflare, com domínio .com.br próprio.',
  },
];

/** Extensões .br organizadas pelo perfil a que se destinam. */
export interface DomainExtension {
  suffix: string;
  audience: string;
}

export const DOMAIN_EXTENSIONS: DomainExtension[] = [
  { suffix: '.com.br', audience: 'Empresas e atividades comerciais em geral' },
  { suffix: '.adv.br', audience: 'Advogados e escritórios de advocacia' },
  { suffix: '.med.br', audience: 'Médicos e clínicas' },
  { suffix: '.odo.br', audience: 'Dentistas e consultórios odontológicos' },
  { suffix: '.psi.br', audience: 'Psicólogos' },
  { suffix: '.eng.br', audience: 'Engenheiros' },
  { suffix: '.arq.br', audience: 'Arquitetos e urbanistas' },
  { suffix: '.vet.br', audience: 'Médicos veterinários' },
  { suffix: '.nut.br', audience: 'Nutricionistas' },
  { suffix: '.cnt.br', audience: 'Contadores e escritórios de contabilidade' },
  { suffix: '.imb.br', audience: 'Imobiliárias e corretores' },
  { suffix: '.srv.br', audience: 'Prestadores de serviço em geral' },
  { suffix: '.ind.br', audience: 'Indústrias' },
  { suffix: '.eco.br', audience: 'Atividades ligadas a sustentabilidade' },
  { suffix: '.app.br', audience: 'Aplicativos e produtos digitais' },
  { suffix: '.blog.br', audience: 'Publicações e conteúdo editorial' },
];

export const REGISTRO_BR_URL = 'https://registro.br/dominio/categorias/';

export const buildWhatsAppUrl = (message: string): string =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
