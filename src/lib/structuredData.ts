import { CASE_STUDIES, CONTACT, PROFILE, SITE_URL } from './config';
import { FAQ_ITEMS } from './faq';
import { SERVICES } from './services';

const SITE_ID = `${SITE_URL}/#site`;
const PAGE_ID = `${SITE_URL}/#pagina`;
const PERSON_ID = `${PROFILE.portfolio}/#pedro-satin`;
const BUSINESS_ID = `${SITE_URL}/#servico`;

const SITE_NAME = 'Pedro Satin: Engenharia Web e Deploy para Projetos com IA';

const DESCRIPTION =
  'Engenharia web e deploy sob demanda para projetos criados com IA (Cursor, Lovable, v0, Bolt). Publicação com domínio próprio, correção de bugs, banco de dados, pagamentos e SEO técnico. Sem mensalidade, código 100% seu.';

function buildServicesCatalog(providerId: string) {
  return {
    '@type': 'OfferCatalog',
    name: 'O que eu resolvo',
    itemListElement: SERVICES.map((service) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: service.title,
        description: service.short,
        provider: { '@id': providerId },
        areaServed: { '@type': 'Country', name: 'Brasil' },
      },
    })),
  };
}

function buildFaqEntity() {
  return FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a.join(' ') },
  }));
}

function buildCaseStudiesList() {
  return CASE_STUDIES.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    url: `https://${item.domain}`,
  }));
}

export const buildStructuredData = (): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        inLanguage: 'pt-BR',
        publisher: { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: CONTACT.name,
        jobTitle: 'Engenheiro de Software e Professor Universitário',
        url: PROFILE.portfolio,
        image: `${SITE_URL}${PROFILE.photo}`,
        knowsAbout: [
          'Engenharia de software',
          'Desenvolvimento web',
          'Deploy de aplicações de IA',
          'Cursor, v0, Lovable e Bolt.new',
          'Otimização de desempenho web',
          'Core Web Vitals',
          'SEO técnico',
          'Integração de banco de dados e Supabase',
          'Integração de pagamentos (Stripe, Asaas)',
          'Configuração de DNS e domínio próprio',
          'Tecnologias Emergentes',
          'Inteligência Artificial',
        ],
        sameAs: [PROFILE.linkedin, PROFILE.github, PROFILE.portfolio],
      },
      {
        '@type': 'ProfessionalService',
        '@id': BUSINESS_ID,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/imagens/compartilhamento.png`,
        description: DESCRIPTION,
        inLanguage: 'pt-BR',
        availableLanguage: 'pt-BR',
        telephone: `+${CONTACT.whatsapp}`,
        areaServed: { '@type': 'Country', name: 'Brasil' },
        provider: { '@id': PERSON_ID },
        founder: { '@id': PERSON_ID },
        hasOfferCatalog: buildServicesCatalog(PERSON_ID),
      },
      {
        '@type': 'WebPage',
        '@id': PAGE_ID,
        url: `${SITE_URL}/`,
        name: 'Publicação, Deploy e Engenharia para Projetos criados com IA | Pedro Satin',
        description: DESCRIPTION,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': SITE_ID },
        about: { '@id': BUSINESS_ID },
        primaryImageOfPage: `${SITE_URL}/imagens/compartilhamento.png`,
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#perguntas`,
        isPartOf: { '@id': PAGE_ID },
        mainEntity: buildFaqEntity(),
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#trabalhos`,
        name: 'Sites que eu fiz',
        itemListElement: buildCaseStudiesList(),
      },
    ],
  }).replace(/</g, '\\u003c');
